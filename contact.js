(function () {
  var serviceUrl = "https://lykos-contact.lyk05.workers.dev";
  var turnstileScript =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var link = document.getElementById("contact");
  if (!link) return;

  function loadTurnstile() {
    return new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var script = document.createElement("script");
      script.src = turnstileScript;
      script.async = true;
      script.onload = function () { resolve(window.turnstile); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function showEmail(target, address) {
    var mail = document.createElement("a");
    mail.href = "mailto:" + address;
    mail.textContent = address;
    target.replaceWith(mail);
  }

  function fail(target, message, err) {
    console.error("contact: " + message, err);
    var note = document.createElement("span");
    note.textContent = "contact unavailable";
    target.replaceWith(note);
  }

  link.addEventListener("click", function (e) {
    e.preventDefault();
    if (link.dataset.state) return;
    link.dataset.state = "asking";

    var widget = document.createElement("span");
    widget.className = "turnstile";
    link.replaceWith(widget);

    Promise.all([
      loadTurnstile(),
      fetch(serviceUrl + "/config").then(function (res) { return res.json(); }),
    ])
      .then(function (results) {
        var turnstile = results[0];
        var sitekey = results[1].sitekey;

        turnstile.render(widget, {
          sitekey: sitekey,
          callback: function (token) {
            fetch(serviceUrl + "/reveal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: token }),
            })
              .then(function (res) {
                if (!res.ok) throw new Error("reveal returned " + res.status);
                return res.json();
              })
              .then(function (data) { showEmail(widget, data.email); })
              .catch(function (err) {
                fail(widget, "could not reveal the address", err);
              });
          },
          "error-callback": function () {
            fail(widget, "the human check failed");
          },
        });
      })
      .catch(function (err) {
        fail(widget, "could not start the human check", err);
      });
  });
})();
