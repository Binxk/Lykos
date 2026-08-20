(function () {
  var serviceUrl = "https://lykos-contact.lyk05.workers.dev";
  var turnstileScript =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  var link = document.getElementById("contact");
  if (!link) return;

  // Cloudflare's script defines window.turnstile, then turnstile.ready fires
  // once the widget code is actually able to render.
  function loadTurnstile() {
    return new Promise(function (resolve, reject) {
      function ready() {
        if (!window.turnstile) return reject(new Error("turnstile missing"));
        window.turnstile.ready(function () { resolve(window.turnstile); });
      }
      if (window.turnstile) return ready();
      var script = document.createElement("script");
      script.src = turnstileScript;
      script.async = true;
      script.onload = ready;
      script.onerror = function () { reject(new Error("script blocked")); };
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
