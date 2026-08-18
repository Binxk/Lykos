(function () {
  var serviceUrl = "https://lykos-contact.lyk05.workers.dev";
  var link = document.getElementById("contact");
  if (!link) return;

  function questionText(challenge) {
    return challenge.a + " + " + challenge.b + " = ";
  }

  link.addEventListener("click", function (e) {
    e.preventDefault();
    if (link.dataset.state) return;
    link.dataset.state = "asking";

    fetch(serviceUrl + "/challenge")
      .then(function (res) { return res.json(); })
      .then(function (challenge) {
        var wrap = document.createElement("span");
        var question = document.createTextNode(questionText(challenge));
        wrap.appendChild(question);
        var input = document.createElement("input");
        input.setAttribute(
          "aria-label",
          "prove you are human: " + challenge.a + " plus " + challenge.b
        );
        input.maxLength = 2;
        wrap.appendChild(input);
        link.replaceWith(wrap);
        input.focus();

        input.addEventListener("keydown", function (ev) {
          if (ev.key !== "Enter") return;
          fetch(serviceUrl + "/reveal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              a: challenge.a,
              b: challenge.b,
              expiry: challenge.expiry,
              signature: challenge.signature,
              answer: input.value
            })
          }).then(function (res) {
            if (res.ok) {
              res.json().then(function (data) {
                var m = document.createElement("a");
                m.href = "mailto:" + data.email;
                m.textContent = data.email;
                wrap.replaceWith(m);
              });
            } else if (res.status === 410) {
              fetch(serviceUrl + "/challenge")
                .then(function (r) { return r.json(); })
                .then(function (fresh) {
                  challenge = fresh;
                  question.textContent = questionText(challenge);
                  input.setAttribute(
                    "aria-label",
                    "prove you are human: " + challenge.a + " plus " + challenge.b
                  );
                  input.value = "";
                  input.placeholder = "";
                });
            } else {
              input.value = "";
              input.placeholder = "no";
            }
          }).catch(function () {
            input.value = "";
            input.placeholder = "?";
          });
        });
      })
      .catch(function () {
        link.dataset.state = "";
      });
  });
})();
