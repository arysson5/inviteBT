(function () {
  "use strict";

  var STORAGE_KEY = "casamentoBT_guest";

  var DEFAULT_IMG =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180" viewBox="0 0 280 180"><rect fill="#fcf8f4" width="280" height="180" rx="12"/><text x="140" y="95" text-anchor="middle" fill="#8f3d4f" font-family="Georgia,serif" font-size="14">Presente</text></svg>'
    );

  var gate = document.getElementById("presentesGate");
  var app = document.getElementById("presentesApp");
  var grid = document.getElementById("presentesGrid");
  var welcome = document.getElementById("presentesWelcome");
  var msgEl = document.getElementById("presentesMessage");
  var loadErr = document.getElementById("presentesLoadErr");
  var statsEl = document.getElementById("presentesStats");
  var statTotal = document.getElementById("presentesStatTotal");
  var statLivres = document.getElementById("presentesStatLivres");
  var logoutBtn = document.getElementById("presentesLogout");
  var meuHint = document.getElementById("presentesMeuHint");
  var recoverForm = document.getElementById("presentesRecoverForm");
  var recoverEmail = document.getElementById("presentesRecoverEmail");
  var recoverSubmit = document.getElementById("presentesRecoverSubmit");
  var recoverErr = document.getElementById("presentesRecoverErr");

  var main = document.querySelector("[data-presentes-api]");
  var apiUrl =
    (main && main.dataset.presentesApi) ||
    window.PRESENTES_API_URL ||
    "/api/presentes";

  var guest = null;
  var presents = [];
  var choices = [];

  function readGuest() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.email || !o.name) return null;
      return {
        name: String(o.name).trim(),
        email: String(o.email).trim().toLowerCase(),
      };
    } catch (e) {
      return null;
    }
  }

  function showGate() {
    if (gate) gate.hidden = false;
    if (app) app.hidden = true;
  }

  function showApp() {
    if (gate) gate.hidden = true;
    if (app) app.hidden = false;
  }

  function showMessage(text, type) {
    if (!msgEl) return;
    msgEl.hidden = false;
    msgEl.className = "rsvp-message rsvp-message--" + (type || "info");
    msgEl.textContent = text;
    window.setTimeout(function () {
      if (msgEl) {
        msgEl.hidden = true;
        msgEl.textContent = "";
      }
    }, 6000);
  }

  function isChosenByAnyone(giftName) {
    return choices.some(function (c) {
      return c.giftName === giftName;
    });
  }

  function myChoice() {
    if (!guest) return null;
    return (
      choices.find(function (c) {
        return c.guestEmail === guest.email;
      }) || null
    );
  }

  function escap(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function updateWelcome() {
    if (!welcome || !guest) return;
    var m = myChoice();
    if (m && m.giftName) {
      welcome.textContent =
        "Olá, " +
        guest.name +
        " — seu presente está em destaque no topo da lista.";
    } else {
      welcome.textContent =
        "Olá, " +
        guest.name +
        " — escolha um presente ou troque depois, se mudar de ideia.";
    }
  }

  function hideRecoverErr() {
    if (!recoverErr) return;
    recoverErr.hidden = true;
    recoverErr.textContent = "";
  }

  function showRecoverErr(msg) {
    if (!recoverErr) return;
    recoverErr.hidden = false;
    recoverErr.textContent = msg;
  }

  function render() {
    if (!grid) return;

    var mine = myChoice();
    var hasMine = !!mine;

    if (meuHint) {
      if (mine && mine.giftName) {
        var aindaNaLista = presents.some(function (p) {
          return p.name === mine.giftName;
        });
        meuHint.hidden = false;
        if (aindaNaLista) {
          meuHint.textContent =
            "Seu presente aparece primeiro na lista, com a etiqueta «Sua escolha».";
        } else {
          meuHint.textContent =
            "Você já havia escolhido um presente. Se ele não aparece abaixo, a lista pode ter sido atualizada — em dúvida, fale com Brunna ou Thiago.";
        }
      } else {
        meuHint.hidden = true;
        meuHint.textContent = "";
      }
    }

    var livres = presents.filter(function (p) {
      return !isChosenByAnyone(p.name);
    }).length;

    if (statsEl && statTotal && statLivres) {
      statsEl.hidden = presents.length === 0;
      statTotal.textContent = String(presents.length);
      statLivres.textContent = String(livres);
    }

    if (presents.length === 0) {
      grid.innerHTML =
        '<p class="presentes-empty">Nenhum presente cadastrado na planilha ainda.</p>';
      return;
    }

    var ordered = presents.slice();
    if (mine && mine.giftName) {
      var gi = ordered.findIndex(function (p) {
        return p.name === mine.giftName;
      });
      if (gi > 0) {
        var picked = ordered.splice(gi, 1)[0];
        ordered.unshift(picked);
      }
    }

    grid.innerHTML = ordered
      .map(function (p) {
        var taken = isChosenByAnyone(p.name);
        var isMine = mine && mine.giftName === p.name;
        var img = p.imageUrl ? escap(p.imageUrl) : DEFAULT_IMG;

        var badge = "";
        var actions = "";

        if (isMine) {
          badge =
            '<span class="presentes-card__badge presentes-card__badge--eu">Sua escolha</span>';
          actions =
            '<button type="button" class="presentes-card__btn presentes-card__btn--ghost" data-act="desmarcar" data-gift="' +
            escap(p.name) +
            '">Desmarcar</button>';
        } else if (taken) {
          badge =
            '<span class="presentes-card__badge presentes-card__badge--fora">Já escolhido</span>';
          actions = '<span class="presentes-card__nao">Indisponível</span>';
        } else if (hasMine) {
          actions =
            '<button type="button" class="presentes-card__btn" data-act="trocar" data-gift="' +
            escap(p.name) +
            '">Trocar para este</button>';
        } else {
          actions =
            '<button type="button" class="presentes-card__btn" data-act="escolher" data-gift="' +
            escap(p.name) +
            '">Escolher</button>';
        }

        var price = p.price
          ? '<span class="presentes-card__price">' + escap(p.price) + "</span>"
          : "";
        var link = p.url
          ? '<a class="presentes-card__link" href="' +
            escap(p.url) +
            '" target="_blank" rel="noopener noreferrer">Ver sugestão</a>'
          : "";

        return (
          '<article class="presentes-card">' +
          badge +
          '<div class="presentes-card__media"><img src="' +
          img +
          '" alt="" loading="lazy" /></div>' +
          '<div class="presentes-card__body">' +
          "<h2 class=\"presentes-card__title\">" +
          escap(p.name) +
          "</h2>" +
          price +
          '<div class="presentes-card__actions">' +
          actions +
          link +
          "</div></div></article>"
        );
      })
      .join("");
  }

  async function apiPost(body) {
    var res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error((data && data.error) || "Falha na requisição.");
    return data;
  }

  async function refresh() {
    var res = await fetch(apiUrl, { method: "GET" });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error((data && data.error) || "Não foi possível carregar a lista.");
    }
    presents = Array.isArray(data.presents) ? data.presents : [];
    choices = Array.isArray(data.choices) ? data.choices : [];
  }

  /** Se a API ainda não tiver `recuperar_sessao`, usa o GET público (só funciona se já houver escolha). */
  async function recuperarPorListaPublica(em) {
    var res = await fetch(apiUrl, { method: "GET" });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      throw new Error(
        (data && data.error) || "Não foi possível carregar a lista."
      );
    }
    var list = Array.isArray(data.choices) ? data.choices : [];
    var c = list.find(function (x) {
      return String(x.guestEmail || "").trim().toLowerCase() === em;
    });
    if (c && String(c.guestName || "").trim()) {
      return {
        ok: true,
        name: String(c.guestName).trim(),
        email: em,
        giftName: (c.giftName && String(c.giftName).trim()) || null,
      };
    }
    throw new Error(
      "Não encontramos este e-mail. Use o mesmo da confirmação de presença ou verifique se já escolheu um presente."
    );
  }

  async function attemptRecuperarEmail(em) {
    var res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recuperar_sessao", email: em }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.ok && data.ok && data.name && data.email) {
      return data;
    }
    var errText = (data && data.error) || "";
    if (res.status === 400 && errText.indexOf("Ação inválida") !== -1) {
      return await recuperarPorListaPublica(em);
    }
    throw new Error(errText || "Não foi possível recuperar.");
  }

  async function onRecoverSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    hideRecoverErr();
    var em = (recoverEmail && recoverEmail.value.trim().toLowerCase()) || "";
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      showRecoverErr("Informe um e-mail válido.");
      return;
    }
    if (recoverSubmit) {
      recoverSubmit.disabled = true;
      recoverSubmit.textContent = "Buscando…";
    }
    try {
      var data = await attemptRecuperarEmail(em);
      if (!data.ok || !data.name || !data.email) {
        throw new Error("Não foi possível concluir a recuperação.");
      }
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ name: data.name, email: data.email })
        );
      } catch (se) {
        console.warn(se);
      }
      guest = readGuest();
      hideRecoverErr();
      showApp();
      if (loadErr) {
        loadErr.hidden = true;
        loadErr.textContent = "";
      }
      await refresh();
      updateWelcome();
      render();
      if (data.giftName) {
        showMessage(
          "Encontramos sua escolha. Ela aparece em destaque no topo da lista.",
          "success"
        );
      } else {
        showMessage(
          "Acesso recuperado. Você ainda não tinha escolhido um presente — veja a lista abaixo.",
          "info"
        );
      }
      if (recoverEmail) recoverEmail.value = "";
    } catch (err) {
      showRecoverErr(
        err.message || "Não foi possível recuperar com este e-mail."
      );
    } finally {
      if (recoverSubmit) {
        recoverSubmit.disabled = false;
        recoverSubmit.textContent = "Ver minha escolha";
      }
    }
  }

  async function onGridClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn || !guest) return;
    var act = btn.getAttribute("data-act");
    var giftName = btn.getAttribute("data-gift");
    if (!giftName) return;

    try {
      if (act === "escolher") {
        if (
          !window.confirm(
            'Confirmar escolha do presente:\n"' + giftName + '"?'
          )
        ) {
          return;
        }
        await apiPost({
          action: "escolher",
          email: guest.email,
          name: guest.name,
          giftName: giftName,
        });
        showMessage("Presente registrado! Obrigado.", "success");
      } else if (act === "trocar") {
        if (
          !window.confirm(
            "Trocar seu presente atual por:\n\"" + giftName + "\"?"
          )
        ) {
          return;
        }
        await apiPost({
          action: "trocar",
          email: guest.email,
          name: guest.name,
          newGiftName: giftName,
        });
        showMessage("Troca registrada.", "success");
      } else if (act === "desmarcar") {
        if (
          !window.confirm(
            "Remover sua escolha? O presente voltará a ficar disponível."
          )
        ) {
          return;
        }
        await apiPost({
          action: "desmarcar",
          email: guest.email,
          giftName: giftName,
        });
        showMessage("Escolha removida.", "success");
      }
      await refresh();
      updateWelcome();
      render();
    } catch (err) {
      console.error(err);
      showMessage(err.message || "Erro ao salvar.", "error");
    }
  }

  async function init() {
    if (recoverForm) {
      recoverForm.addEventListener("submit", function (e) {
        onRecoverSubmit(e).catch(function (err) {
          console.error(err);
          showRecoverErr(
            err.message || "Não foi possível recuperar com este e-mail."
          );
          if (recoverSubmit) {
            recoverSubmit.disabled = false;
            recoverSubmit.textContent = "Ver minha escolha";
          }
        });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        localStorage.removeItem(STORAGE_KEY);
        guest = null;
        hideRecoverErr();
        if (recoverEmail) recoverEmail.value = "";
        showGate();
      });
    }

    guest = readGuest();
    if (!guest) {
      showGate();
      return;
    }

    showApp();
    if (welcome) {
      welcome.textContent =
        "Olá, " + guest.name + " — escolha um presente ou troque depois.";
    }

    if (loadErr) {
      loadErr.hidden = true;
      loadErr.textContent = "";
    }

    try {
      await refresh();
      updateWelcome();
      render();
    } catch (err) {
      console.error(err);
      if (loadErr) {
        loadErr.hidden = false;
        loadErr.textContent =
          err.message ||
          "Não foi possível carregar a lista. Verifique sua conexão e tente de novo.";
      }
    }

    if (grid) grid.addEventListener("click", onGridClick);
  }

  init();
})();
