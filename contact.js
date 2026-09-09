(function () {
  var serviceUrl = "https://lykos-contact.lyk05.workers.dev";
  var turnstileScript =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var link = document.getElementById("contact");
  if (!link) return;

  // Cloudflare's script calls the global named in its onload parameter once
  // the widget code can render. That path is used instead of
  // turnstile.ready(), which throws when the script tag was added with async
  // and would leave the click hanging with no visible error.
  function loadTurnstile() {
    return new Promise(function (resolve, reject) {
      if (window.turnstile) return resolve(window.turnstile);
      var timer = setTimeout(function () {
        reject(new Error("timeout"));
      }, 15000);
      window.lykosTurnstileLoaded = function () {
        clearTimeout(timer);
        delete window.lykosTurnstileLoaded;
        if (!window.turnstile) return reject(new Error("turnstile missing"));
        resolve(window.turnstile);
      };
      var script = document.createElement("script");
      script.src = turnstileScript + "&onload=lykosTurnstileLoaded";
      script.async = true;
      script.onerror = function () {
        clearTimeout(timer);
        reject(new Error("script blocked"));
      };
      document.head.appendChild(script);
    });
  }

  function showEmail(target, address) {
    var mail = document.createElement("a");
    mail.href = "mailto:" + address;
    mail.textContent = address;
    target.replaceWith(mail);
  }

  function fail(target, code, err) {
    console.error("contact failed [" + code + "]", err);
    var note = document.createElement("span");
    note.textContent = "contact unavailable [" + code + "]";
    target.replaceWith(note);
  }

  link.addEventListener("click", function (e) {
    e.preventDefault();
    if (link.dataset.state) return;
    link.dataset.state = "asking";

    var widget = document.createElement("div");
    widget.className = "turnstile";
    link.replaceWith(widget);

    var turnstile;
    loadTurnstile()
      .catch(function (err) {
        throw new Error("load:" + err.message);
      })
      .then(function (api) {
        turnstile = api;
        return fetch(serviceUrl + "/config").then(function (res) {
          if (!res.ok) throw new Error("config:" + res.status);
          return res.json();
        });
      })
      .then(function (config) {
        if (!config.sitekey) throw new Error("config:no-sitekey");
        turnstile.render(widget, {
          sitekey: config.sitekey,
          callback: function (token) {
            fetch(serviceUrl + "/reveal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: token }),
            })
              .then(function (res) {
                if (!res.ok) throw new Error("reveal:" + res.status);
                return res.json();
              })
              .then(function (data) { showEmail(widget, data.email); })
              .catch(function (err) { fail(widget, err.message, err); });
          },
          "error-callback": function (code) {
            fail(widget, "widget:" + code);
            return true;
          },
        });
      })
      .catch(function (err) {
        fail(widget, err.message, err);
      });
  });
})();
