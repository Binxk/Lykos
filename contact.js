(function () {
  const link = document.getElementById("contact");
  if (!link) return;
  const addr = [104, 51, 108, 108, 48, 64, 108, 121, 107, 48, 53, 46, 99, 111, 109]
    .map(function (c) { return String.fromCharCode(c); }).join("");
  link.addEventListener("click", function (e) {
    e.preventDefault();
    if (link.dataset.state) return;
    link.dataset.state = "asking";
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    const wrap = document.createElement("span");
    wrap.appendChild(document.createTextNode(a + " + " + b + " = "));
    const input = document.createElement("input");
    input.setAttribute("aria-label", "prove you are human: " + a + " plus " + b);
    input.maxLength = 2;
    wrap.appendChild(input);
    link.replaceWith(wrap);
    input.focus();
    input.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      if (parseInt(input.value, 10) === a + b) {
        const m = document.createElement("a");
        m.href = "mailto:" + addr;
        m.textContent = addr;
        wrap.replaceWith(m);
      } else {
        input.value = "";
        input.placeholder = "no";
      }
    });
  });
})();
