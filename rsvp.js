(function () {
  "use strict";

  const form = document.getElementById("rsvpForm");
  const msgEl = document.getElementById("rsvpMessage");
  const submitBtn = document.getElementById("rsvpSubmit");

  const apiRoot = document.querySelector("[data-rsvp-api]");
  const apiUrl =
    (apiRoot && apiRoot.dataset.rsvpApi) ||
    window.RSVP_API_URL ||
    "/api/rsvp";

  function showMessage(text, type) {
    if (!msgEl) return;
    msgEl.hidden = false;
    msgEl.className = "rsvp-message rsvp-message--" + (type || "info");
    msgEl.textContent = text;
  }

  function hideMessage() {
    if (!msgEl) return;
    msgEl.hidden = true;
    msgEl.textContent = "";
    msgEl.className = "rsvp-message";
  }

  function readTitular() {
    const nameEl = document.getElementById("titularName");
    const emailEl = document.getElementById("titularEmail");
    const name = (nameEl && nameEl.value.trim()) || "";
    const email = (emailEl && emailEl.value.trim().toLowerCase()) || "";
    return { name, email, count: "1" };
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function parseResponse(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      const hint =
        res.status >= 500
          ? " Tente de novo em alguns minutos; se persistir, avise Brunna ou Thiago."
          : "";
      throw new Error("Não foi possível concluir o envio agora." + hint);
    }
  }

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    hideMessage();

    const titular = readTitular();

    if (!titular.name) {
      showMessage("Informe seu nome completo.", "error");
      return;
    }
    if (!validateEmail(titular.email)) {
      showMessage("Informe um e-mail válido.", "error");
      return;
    }

    const originalLabel = submitBtn ? submitBtn.textContent : "";
    let willRedirect = false;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";
    }

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titular: {
            name: titular.name,
            email: titular.email,
            count: titular.count,
          },
        }),
      });

      let data;
      try {
        data = await parseResponse(res);
      } catch (parseErr) {
        showMessage(parseErr.message || "Erro ao ler resposta.", "error");
        return;
      }

      if (!res.ok) {
        showMessage(
          (data && data.error) ||
            "Não foi possível enviar agora. Tente de novo em instantes.",
          "error"
        );
        return;
      }

      try {
        localStorage.setItem(
          "casamentoBT_guest",
          JSON.stringify({
            name: titular.name,
            email: titular.email,
          })
        );
      } catch (storeErr) {
        console.warn(storeErr);
      }

      showMessage(
        (data && data.message) ||
          "Obrigado pela confirmação! Em instantes você verá a lista de presentes.",
        "success"
      );
      form.reset();

      willRedirect = true;
      if (submitBtn) submitBtn.textContent = "Redirecionando…";
      window.setTimeout(function () {
        window.location.href = "presentes.html";
      }, 1600);
    } catch (err) {
      console.error(err);
      showMessage(
        err.message ||
          "Não foi possível conectar. Verifique sua internet e tente novamente.",
        "error"
      );
    } finally {
      if (submitBtn && !willRedirect) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  });
})();
