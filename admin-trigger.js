/**
 * Um toque/clique em qualquer <img> do monograma B&T abre o painel admin (após validar senha na API).
 */
(function () {
  "use strict";

  var MON = "Gemini_Generated_Image_46mktt46mktt46mk-removebg-preview";

  function apiAdmin() {
    var el = document.querySelector("[data-admin-api]");
    if (el && el.dataset.adminApi) {
      return el.dataset.adminApi.replace(/\/$/, "");
    }
    return "/api/admin";
  }

  async function loginRequest(password) {
    var res = await fetch(apiAdmin(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password: password }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    return res.ok && data.ok === true;
  }

  document.addEventListener(
    "click",
    async function (e) {
      var t = e.target;
      if (!t || t.tagName !== "IMG") return;
      var src = (t.currentSrc || t.src || t.getAttribute("src") || "").replace(
        /\\/g,
        "/"
      );
      if (src.indexOf(MON) === -1) return;

      e.preventDefault();
      e.stopPropagation();

      var pwd = window.prompt("Senha do painel administrativo:");
      if (pwd === null || pwd === "") return;

      try {
        var ok = await loginRequest(pwd);
        if (!ok) {
          window.alert("Senha incorreta.");
          return;
        }
        try {
          sessionStorage.setItem("casamentoBT_admin_pwd", pwd);
        } catch (err) {
          console.warn(err);
        }
        window.location.href = "admin.html";
      } catch (err) {
        console.error(err);
        window.alert(
          "Não foi possível validar a senha. Use o mesmo endereço do site com a API (ex.: npm run dev)."
        );
      }
    },
    true
  );
})();
