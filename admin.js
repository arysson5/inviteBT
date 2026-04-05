(function () {
  "use strict";

  var STORAGE_KEY = "casamentoBT_admin_pwd";

  var el = {
    login: document.getElementById("adminLogin"),
    panel: document.getElementById("adminPanel"),
    pwd: document.getElementById("adminPwdInput"),
    loginBtn: document.getElementById("adminLoginBtn"),
    loginErr: document.getElementById("adminLoginErr"),
    logout: document.getElementById("adminLogout"),
    refresh: document.getElementById("adminRefresh"),
    msg: document.getElementById("adminMsg"),
    statPessoas: document.getElementById("statPessoas"),
    statCap: document.getElementById("statCap"),
    barFill: document.getElementById("bar120Fill"),
    barTxt: document.getElementById("bar120Txt"),
    statNP: document.getElementById("statNP"),
    statEsc: document.getElementById("statEsc"),
    statPct: document.getElementById("statPct"),
    formAdd: document.getElementById("formAddPresente"),
    listaEsc: document.getElementById("listaEscolhas"),
    listaEscVazia: document.getElementById("listaEscolhasVazia"),
    listaPres: document.getElementById("listaPresentes"),
    listaConv: document.getElementById("listaConvidados"),
  };

  var lastOverview = null;

  function apiUrl() {
    var m = document.querySelector("[data-admin-api]");
    return (m && m.dataset.adminApi) || "/api/admin";
  }

  function getPwd() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  }

  function setPwd(p) {
    try {
      if (p) sessionStorage.setItem(STORAGE_KEY, p);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn(err);
    }
  }

  function authHeaders() {
    return {
      Authorization: "Bearer " + getPwd(),
      "Content-Type": "application/json",
    };
  }

  function showMsg(text, type) {
    if (!el.msg) return;
    el.msg.hidden = false;
    el.msg.className = "rsvp-message rsvp-message--" + (type || "info");
    el.msg.textContent = text;
    window.setTimeout(function () {
      if (el.msg) el.msg.hidden = true;
    }, 5000);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function render(data) {
    if (!data || !data.ok) return;

    var cap = data.capacidadeMax || 120;
    var pessoas = data.totalPessoas || 0;
    if (el.statCap) el.statCap.textContent = String(cap);
    if (el.statPessoas) el.statPessoas.textContent = String(pessoas);

    var pctBar = Math.min(100, (pessoas / cap) * 100);
    if (el.barFill) {
      el.barFill.style.width = pctBar + "%";
      el.barFill.parentElement.setAttribute(
        "aria-valuenow",
        String(Math.min(pessoas, cap))
      );
    }
    if (el.barTxt) {
      el.barTxt.textContent = pessoas + " / " + cap;
      if (pessoas > cap) el.barTxt.textContent += " (acima da meta)";
    }

    if (el.statNP) el.statNP.textContent = String(data.nPresentes || 0);
    if (el.statEsc) el.statEsc.textContent = String(data.nEscolhidos || 0);
    if (el.statPct) el.statPct.textContent = (data.pctPresentes || 0) + "%";

    var choices = data.choices || [];
    if (el.listaEsc) {
      if (choices.length === 0) {
        el.listaEsc.innerHTML = "";
        if (el.listaEscVazia) el.listaEscVazia.hidden = false;
      } else {
        if (el.listaEscVazia) el.listaEscVazia.hidden = true;
        el.listaEsc.innerHTML = choices
          .map(function (c) {
            return (
              "<li><strong>" +
              esc(c.giftName) +
              "</strong> — " +
              esc(c.guestName) +
              " <span class=\"admin-meta\">" +
              esc(c.guestEmail) +
              "</span></li>"
            );
          })
          .join("");
      }
    }

    var presents = data.presents || [];
    if (el.listaPres) {
      el.listaPres.innerHTML = presents
        .map(function (p) {
          var taken = choices.some(function (c) {
            return c.giftName === p.name;
          });
          var keyEnc = encodeURIComponent(p.name);
          return (
            "<li class=\"admin-pres-item\"><div class=\"admin-pres-main\"><strong>" +
            esc(p.name) +
            "</strong>" +
            (p.price ? " · " + esc(p.price) : "") +
            (taken
              ? " <span class=\"admin-tag admin-tag--ok\">reservado</span>"
              : " <span class=\"admin-tag\">livre</span>") +
            "</div><div class=\"admin-pres-btns\">" +
            "<button type=\"button\" class=\"admin-edit\" data-key-enc=\"" +
            keyEnc +
            "\">Editar</button>" +
            "<button type=\"button\" class=\"admin-del\" data-key-enc=\"" +
            keyEnc +
            "\">Excluir</button></div></li>"
          );
        })
        .join("");
    }

    var conv = data.convidados || [];
    if (el.listaConv) {
      el.listaConv.innerHTML = conv
        .map(function (c) {
          return (
            "<li>" +
            esc(c.name) +
            " <span class=\"admin-meta\">" +
            esc(c.email) +
            "</span> · qtd. " +
            esc(c.count) +
            "</li>"
          );
        })
        .join("");
    }

    lastOverview = data;
  }

  function findPresLiByKeyEnc(enc) {
    if (!el.listaPres || !enc) return null;
    var edits = el.listaPres.querySelectorAll(".admin-edit");
    for (var i = 0; i < edits.length; i++) {
      if (edits[i].getAttribute("data-key-enc") === enc) {
        return edits[i].closest("li");
      }
    }
    return null;
  }

  function openEditPresRow(li, p) {
    li.className = "admin-pres-item admin-pres-item--editing";
    li.replaceChildren();

    var form = document.createElement("form");
    form.className = "admin-pres-edit-form";

    function addField(labelText, inputName, value, type, placeholder) {
      var lab = document.createElement("label");
      lab.className = "rsvp-label";
      lab.setAttribute("for", "ep-" + inputName + "-" + p.id);
      lab.textContent = labelText;
      var inp = document.createElement("input");
      inp.className = "rsvp-input";
      inp.id = "ep-" + inputName + "-" + p.id;
      inp.name = inputName;
      if (type) inp.type = type;
      if (placeholder) inp.placeholder = placeholder;
      inp.value = value || "";
      form.appendChild(lab);
      form.appendChild(inp);
      return inp;
    }

    var inpNome = addField("Nome do item *", "name", p.name, null, null);
    inpNome.required = true;
    inpNome.maxLength = 200;
    addField("URL (loja)", "url", p.url, "url", "https://");
    addField("Preço", "price", p.price, null, "R$ …");
    addField("URL da foto", "imageUrl", p.imageUrl, "url", "https://");

    var actions = document.createElement("div");
    actions.className = "admin-pres-actions";

    var btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "admin-refresh";
    btnCancel.textContent = "Cancelar";
    btnCancel.addEventListener("click", function () {
      if (lastOverview) render(lastOverview);
    });

    var btnSave = document.createElement("button");
    btnSave.type = "submit";
    btnSave.className = "rsvp-submit";
    btnSave.textContent = "Salvar";

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    form.appendChild(actions);

    var originalName = p.name;

    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      try {
        await postAction({
          action: "update_presente",
          originalName: originalName,
          name: inpNome.value.trim(),
          url: form.querySelector('[name="url"]').value.trim(),
          price: form.querySelector('[name="price"]').value.trim(),
          imageUrl: form.querySelector('[name="imageUrl"]').value.trim(),
        });
        showMsg("Presente atualizado.", "success");
      } catch (err) {
        showMsg(err.message, "error");
      }
    });

    li.appendChild(form);
  }

  async function fetchOverview() {
    var res = await fetch(apiUrl(), { headers: authHeaders() });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.status === 401) {
      setPwd("");
      showLogin();
      throw new Error("Sessão expirada ou senha inválida.");
    }
    if (!res.ok) {
      throw new Error((data && data.error) || "Erro ao carregar.");
    }
    render(data);
    return data;
  }

  function showLogin() {
    if (el.login) el.login.hidden = false;
    if (el.panel) el.panel.hidden = true;
    if (el.loginErr) {
      el.loginErr.hidden = true;
      el.loginErr.textContent = "";
    }
  }

  function showPanel() {
    if (el.login) el.login.hidden = true;
    if (el.panel) el.panel.hidden = false;
  }

  async function doLogin(password) {
    var res = await fetch(apiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password: password }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    return res.ok && data.ok === true;
  }

  async function onLoginSubmit() {
    var p = (el.pwd && el.pwd.value) || "";
    if (!el.loginErr) return;
    el.loginErr.hidden = true;
    if (!p) {
      el.loginErr.textContent = "Informe a senha.";
      el.loginErr.hidden = false;
      return;
    }
    try {
      var ok = await doLogin(p);
      if (!ok) {
        el.loginErr.textContent = "Senha incorreta.";
        el.loginErr.hidden = false;
        return;
      }
      setPwd(p);
      showPanel();
      await fetchOverview();
      showMsg("Dados carregados.", "success");
    } catch (e) {
      el.loginErr.textContent = e.message || "Falha na conexão.";
      el.loginErr.hidden = false;
    }
  }

  async function postAction(body) {
    var res = await fetch(apiUrl(), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.status === 401) {
      setPwd("");
      showLogin();
      throw new Error("Não autorizado.");
    }
    if (!res.ok) {
      throw new Error((data && data.error) || "Erro.");
    }
    render(data);
    return data;
  }

  function init() {
    if (el.loginBtn) {
      el.loginBtn.addEventListener("click", onLoginSubmit);
    }
    if (el.pwd) {
      el.pwd.addEventListener("keydown", function (e) {
        if (e.key === "Enter") onLoginSubmit();
      });
    }

    if (el.logout) {
      el.logout.addEventListener("click", function () {
        setPwd("");
        showLogin();
        if (el.pwd) el.pwd.value = "";
      });
    }

    if (el.refresh) {
      el.refresh.addEventListener("click", async function () {
        try {
          await fetchOverview();
          showMsg("Atualizado.", "success");
        } catch (e) {
          showMsg(e.message, "error");
        }
      });
    }

    if (el.formAdd) {
      el.formAdd.addEventListener("submit", async function (e) {
        e.preventDefault();
        try {
          await postAction({
            action: "add_presente",
            name: document.getElementById("apNome").value,
            url: document.getElementById("apUrl").value,
            price: document.getElementById("apPreco").value,
            imageUrl: document.getElementById("apImg").value,
          });
          el.formAdd.reset();
          showMsg("Presente adicionado.", "success");
        } catch (err) {
          showMsg(err.message, "error");
        }
      });
    }

    if (el.listaPres) {
      el.listaPres.addEventListener("click", async function (e) {
        var editBtn = e.target.closest(".admin-edit");
        if (editBtn) {
          e.preventDefault();
          var enc = editBtn.getAttribute("data-key-enc");
          if (!enc || !lastOverview) return;
          if (document.querySelector(".admin-pres-item--editing")) {
            render(lastOverview);
          }
          var li = findPresLiByKeyEnc(enc);
          if (!li) return;
          var originalName = decodeURIComponent(enc);
          var pres = lastOverview.presents || [];
          var p = null;
          for (var j = 0; j < pres.length; j++) {
            if (pres[j].name === originalName) {
              p = pres[j];
              break;
            }
          }
          if (!p) return;
          openEditPresRow(li, p);
          return;
        }

        var btn = e.target.closest(".admin-del");
        if (!btn) return;
        var encDel = btn.getAttribute("data-key-enc");
        if (!encDel) return;
        var gift = decodeURIComponent(encDel);
        if (
          !window.confirm(
            'Excluir o presente "' + gift + '" e reservas ligadas a ele?'
          )
        ) {
          return;
        }
        try {
          await postAction({ action: "delete_presente", giftName: gift });
          showMsg("Removido.", "success");
        } catch (err) {
          showMsg(err.message, "error");
        }
      });
    }

    var pwd = getPwd();
    if (pwd) {
      showPanel();
      fetchOverview().catch(function (e) {
        showMsg(e.message, "error");
        showLogin();
      });
    } else {
      showLogin();
    }
  }

  init();
})();
