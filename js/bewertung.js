/* =========================================================
   EASY2MOOVE – BEWERTUNGSASSISTENT
   Datei: script.js
   Hinweis: Sendet Anfragen über den Website-Mailendpunkt.
   ========================================================= */
(() => {
  "use strict";

  const form = document.querySelector("#moving-form");
  const panels = [...document.querySelectorAll(".step-panel")];
  const nextBtn = document.querySelector("#next-btn");
  const submitBtn = document.querySelector("#submit-btn");
  const backBtn = document.querySelector("#back-btn");
  const progressFill = document.querySelector("#progress-fill");
  const progressTrack = document.querySelector("#progress-track");
  const stepKicker = document.querySelector("#step-kicker");
  const stepTitle = document.querySelector("#step-title");
  const progressPercent = document.querySelector("#progress-percent");
  const successPanel = document.querySelector("#success-panel");
  const wizardActions = document.querySelector(".wizard-actions");
  const titles = [
    "Was können wir für Sie tun?",
    "Wie groß ist der Umzug?",
    "Wo startet Ihr Umzug?",
    "Wohin und wann geht es?",
    "Welche Zusatzleistungen benötigen Sie?",
    "Gibt es Besonderheiten?",
    "Wie können wir Sie erreichen?"
  ];
  let currentStep = 0;
  const counters = { living: 1, kitchen: 1, bedroom: 1, bathhall: 1, workplaces: 5, other: 0 };
  let selectedService = "";

  const get = (id) => document.getElementById(id);
  const val = (id) => (get(id)?.value || "").trim();
  const checkedValues = (name) => [...form.querySelectorAll(`[name="${name}"]:checked`)].map((el) => el.value);

  function updateServiceVisibility() {
    const office = selectedService === "Firmenumzug";
    get("office-wrap").classList.toggle("hidden", !office);
    get("household-wrap").classList.toggle("hidden", office || ["Entrümpelung", "Möbeltransport", "Montage"].includes(selectedService));
    get("property-type-wrap").classList.toggle("hidden", ["Entrümpelung", "Möbeltransport", "Montage"].includes(selectedService));
    document.querySelectorAll(".office-only").forEach((el) => el.classList.toggle("hidden", !office));
    document.querySelectorAll("#room-grid .room-counter:not(.office-only)").forEach((el) => {
      el.classList.toggle("hidden", office && ["living", "kitchen", "bedroom", "bathhall"].some(k => el.querySelector(`[data-counter="${k}"]`)));
    });
  }

  document.querySelectorAll('[data-choice-group="service"] .choice-card').forEach((button) => {
    button.addEventListener("click", () => {
      selectedService = button.dataset.value;
      document.querySelectorAll(".choice-card").forEach((card) => {
        const selected = card === button;
        card.classList.toggle("is-selected", selected);
        card.setAttribute("aria-pressed", String(selected));
      });
      updateServiceVisibility();
    });
  });

  document.querySelectorAll("[data-counter]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.counter;
      const delta = Number(button.dataset.delta);
      counters[key] = Math.max(0, Math.min(key === "workplaces" ? 500 : 10, counters[key] + delta));
      get(`count-${key}`).textContent = counters[key];
    });
  });

  get("same-address").addEventListener("change", (event) => {
    const same = event.target.checked;
    get("destination-fields").classList.toggle("hidden", same);
    ["to-street", "to-zip", "to-city"].forEach((id) => { get(id).required = !same; });
  });

  function validateStep(step) {
    const panel = panels[step];
    if (step === 0 && !selectedService) {
      alert("Bitte wählen Sie zuerst eine Leistung aus.");
      return false;
    }
    if (step === 2) {
      const required = ["from-street", "from-zip", "from-city"];
      for (const id of required) {
        const field = get(id);
        if (!field.value.trim()) {
          field.focus();
          field.setCustomValidity("Bitte füllen Sie dieses Feld aus.");
          field.reportValidity();
          field.setCustomValidity("");
          return false;
        }
      }
      if (!/^\d{4,6}$/.test(val("from-zip"))) {
        get("from-zip").setCustomValidity("Bitte geben Sie eine gültige Postleitzahl ein.");
        get("from-zip").reportValidity();
        get("from-zip").setCustomValidity("");
        return false;
      }
    }
    if (step === 3 && !get("same-address").checked) {
      const required = ["to-street", "to-zip", "to-city"];
      for (const id of required) {
        if (!val(id)) {
          get(id).focus();
          get(id).setCustomValidity("Bitte füllen Sie dieses Feld aus oder markieren Sie, dass die Zieladresse noch nicht bekannt ist.");
          get(id).reportValidity();
          get(id).setCustomValidity("");
          return false;
        }
      }
    }
    if (step === 6) {
      const name = get("name");
      const phone = get("phone");
      const email = get("email");
      if (!name.value.trim() || !phone.value.trim() || !email.value.trim() || !get("privacy").checked) {
        form.reportValidity();
        return false;
      }
      if (!email.checkValidity()) { email.reportValidity(); return false; }
    }
    return true;
  }

  function buildSummary() {
    const serviceLabels = checkedValues("services");
    const extras = checkedValues("extraAreas");
    const heavy = checkedValues("heavyItems");
    const rooms = selectedService === "Firmenumzug"
      ? `Arbeitsplätze: ${counters.workplaces}; weitere Räume: ${counters.other}`
      : `Wohn-/Esszimmer: ${counters.living}; Küche: ${counters.kitchen}; Schlafzimmer: ${counters.bedroom}; Bad/Flur: ${counters.bathhall}; weitere Räume: ${counters.other}`;
    const fromAddress = [val("from-street"), val("from-zip"), val("from-city")].filter(Boolean).join(", ");
    const destination = get("same-address").checked
      ? "Noch nicht bekannt"
      : [val("to-street"), val("to-zip"), val("to-city")].filter(Boolean).join(", ");
    const date = val("move-date") ? new Date(`${val("move-date")}T00:00:00`).toLocaleDateString("de-DE") : "Noch offen";
    const files = [...get("photos").files].map((file) => file.name);
    const rows = [
      ["Gewünschte Leistung", selectedService || "—"],
      ["Umzugsobjekt", val("property-type") || "Nicht angegeben"],
      ["Haushaltsgröße", val("household") || "Nicht angegeben"],
      ["Fläche", selectedService === "Firmenumzug" ? (val("office-size") || "Nicht angegeben") : (val("area") || "Nicht angegeben")],
      ["Bücher-/Archivregale", val("shelf-meters") ? `${val("shelf-meters")} laufende Meter` : "Nicht angegeben"],
      ["Umfang", rooms],
      ["Zusätzliche Bereiche", extras.join(", ") || "Keine ausgewählt"],
      ["Besondere Gegenstände", heavy.join(", ") || "Keine ausgewählt"],
      ["Bisherige Adresse", fromAddress || "—"],
      ["Etage am Startort", val("from-floor") || "Nicht angegeben"],
      ["Aufzug am Startort", val("from-elevator") || "Nicht angegeben"],
      ["Parken am Startort", val("from-parking") || "Nicht angegeben"],
      ["Zugang am Startort", val("from-access") || "Nicht angegeben"],
      ["Zieladresse", destination || "—"],
      ["Etage am Zielort", get("same-address").checked ? "Noch nicht bekannt" : (val("to-floor") || "Nicht angegeben")],
      ["Aufzug am Zielort", get("same-address").checked ? "Noch nicht bekannt" : (val("to-elevator") || "Nicht angegeben")],
      ["Parken am Zielort", get("same-address").checked ? "Noch nicht bekannt" : (val("to-parking") || "Nicht angegeben")],
      ["Wunschtermin", date],
      ["Terminflexibilität", val("date-flex") || "Nicht angegeben"],
      ["Zusatzleistungen", serviceLabels.join(", ") || "Keine ausgewählt"],
      ["Weitere Wünsche", val("other-service") || "Keine"],
      ["Hinweise", val("notes") || "Keine"],
      ["Dateianhänge", files.join(", ") || "Keine ausgewählt"],
      ["Name", val("name")],
      ["Telefon", val("phone")],
      ["E-Mail", val("email")],
      ["Bevorzugter Kontakt", val("contact-method") || "Nicht angegeben"]
    ];
    get("summary-content").innerHTML = rows.map(([label, value]) =>
      `<div class="summary-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    ).join("");
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showStep(step) {
    currentStep = Math.max(0, Math.min(panels.length - 1, step));
    panels.forEach((panel, index) => panel.classList.toggle("is-active", index === currentStep));
    const count = panels.length;
    const percent = Math.round(((currentStep + 1) / count) * 100);
    stepKicker.textContent = `SCHRITT ${currentStep + 1} VON ${count}`;
    stepTitle.textContent = titles[currentStep];
    progressPercent.textContent = `${percent} %`;
    progressFill.style.width = `${percent}%`;
    progressTrack.setAttribute("aria-valuenow", String(currentStep + 1));
    backBtn.disabled = currentStep === 0;
    nextBtn.classList.toggle("hidden", currentStep === count - 1);
    submitBtn.classList.toggle("hidden", currentStep !== count - 1);
    if (currentStep === count - 1) buildSummary();
    const cardTop = document.querySelector(".wizard-card").getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: cardTop, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  nextBtn.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    showStep(currentStep + 1);
  });
  backBtn.addEventListener("click", () => showStep(currentStep - 1));
  get("edit-summary").addEventListener("click", () => showStep(0));

  function collectData() {
    const data = {};
    new FormData(form).forEach((value, key) => {
      if (value instanceof File) return;
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else data[key] = value;
    });
    data.service = selectedService;
    data.counters = { ...counters };
    data.extraAreas = checkedValues("extraAreas");
    data.heavyItems = checkedValues("heavyItems");
    data.services = checkedValues("services");
    data.filesNotTransferred = [...get("photos").files].map(file => file.name);
    return data;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;
    buildSummary();
    const error = get("submit-error");
    error.hidden = true;

    const data = collectData();
    data.summary = [...document.querySelectorAll("#summary-content .summary-line")].map((row) => ({
      label: row.querySelector("span").textContent,
      value: row.querySelector("strong").textContent
    }));
    data.privacyAccepted = get("privacy").checked;

    const payload = new FormData();
    payload.append("request", JSON.stringify(data));
    [...get("photos").files].forEach((file) => payload.append("photos[]", file));

    submitBtn.disabled = true;
    submitBtn.textContent = "Anfrage wird gesendet …";
    try {
      const response = await fetch("bewertung-senden.php", {
        method: "POST",
        body: payload,
        headers: { Accept: "application/json" }
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Die Anfrage konnte nicht gesendet werden.");
      if (!result) throw new Error("Die Serverantwort war ungültig. Bitte versuchen Sie es erneut.");

      window.__easy2mooveDraft = data;
      successPanel.querySelector("h2").textContent = "Anfrage erfolgreich gesendet";
      successPanel.querySelectorAll("p").forEach((paragraph, index) => {
        paragraph.textContent = index === 0
          ? "Vielen Dank. Ihre Anfrage wurde über die Website an den Mailserver von Easy2Moove übermittelt."
          : "Wir melden uns unter den angegebenen Kontaktdaten. Die Zustellung der E-Mail hängt zusätzlich vom Mailserver ab.";
      });
      form.classList.add("hidden");
      wizardActions.classList.add("hidden");
      document.querySelector(".progress-top").classList.add("hidden");
      document.querySelector(".progress-track").classList.add("hidden");
      successPanel.classList.remove("hidden");
    } catch (sendError) {
      error.textContent = sendError instanceof TypeError
        ? "Der Server ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt unter info@easy2moove.de."
        : sendError.message;
      error.hidden = false;
      error.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Anfrage über die Website senden <span aria-hidden="true">→</span>';
    }
  });

  get("download-btn").addEventListener("click", () => {
    const data = window.__easy2mooveDraft || collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "easy2moove-anfrage-entwurf.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  get("restart-btn").addEventListener("click", () => window.location.reload());
  updateServiceVisibility();
  showStep(0);
})();
