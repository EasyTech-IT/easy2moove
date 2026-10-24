/* ==========================================================================
   Easy2Moove Logistik – JavaScript
   Navigation, FAQ-Akkordeon, Form-Validierung, Consent, Lazy-Load, Back-to-top
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ---------- Responsive homepage hero video ---------- */
  const heroVideo = document.querySelector(".hero__video");

  if (heroVideo) {
    const mobileQuery = window.matchMedia("(max-width: 600px)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updateHeroVideo = () => {
      if (reducedMotionQuery.matches) {
        heroVideo.autoplay = false;
        heroVideo.pause();
        heroVideo.removeAttribute("src");
        delete heroVideo.dataset.activeSource;
        heroVideo.load();
        return;
      }

      const source = mobileQuery.matches
        ? heroVideo.dataset.mobileSrc
        : heroVideo.dataset.desktopSrc;

      if (!source || heroVideo.dataset.activeSource === source) return;

      heroVideo.dataset.activeSource = source;
      heroVideo.autoplay = true;
      heroVideo.src = source;
      heroVideo.load();
    };

    updateHeroVideo();
    mobileQuery.addEventListener("change", updateHeroVideo);
    reducedMotionQuery.addEventListener("change", updateHeroVideo);
  }

  /* ---------- Flip Cards (mobile tap) ---------- */
  document.querySelectorAll(".flip-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (window.innerWidth < 1024) {
        document.querySelectorAll(".flip-card--flipped").forEach((c) => {
          if (c !== card) c.classList.remove("flip-card--flipped");
        });
        card.classList.toggle("flip-card--flipped");
      }
    });
  });

  /* ---------- Mobile Navigation ---------- */
  const toggle = document.querySelector(".nav__toggle");
  const nav = document.querySelector(".nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("nav--open");
    });

    // Sub-dropdown toggle on mobile
    document
      .querySelectorAll(".nav__item--has-dropdown > .nav__link")
      .forEach((link) => {
        link.addEventListener("click", (e) => {
          if (window.innerWidth < 1024) {
            e.preventDefault();
            link.parentElement.classList.toggle("nav__item--open");
          }
        });
      });
  }

  /* ---------- FAQ Akkordeon ---------- */
  document.querySelectorAll(".faq-item__question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      const answer = btn.nextElementSibling;
      answer.classList.toggle("faq-item__answer--open");
    });
  });

  /* ---------- Formular-Validierung ---------- */
  const updateDescription = (field, errorId, addError) => {
    if (!errorId) return;
    const descriptions = new Set(
      (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean),
    );
    if (addError) descriptions.add(errorId);
    else descriptions.delete(errorId);
    if (descriptions.size) {
      field.setAttribute("aria-describedby", Array.from(descriptions).join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  };

  document.querySelectorAll(".form[data-validate]").forEach((form) => {
    form.setAttribute("novalidate", "");
    const errorMessages = form.querySelectorAll(".form__error");
    errorMessages.forEach((error) => {
      error.dataset.defaultMessage = error.textContent;
    });

    const clearGroupError = (group) => {
      if (!group) return;
      group.classList.remove("form__group--error");
      const error = group.querySelector(".form__error");
      group.querySelectorAll("input, select, textarea, [role='radiogroup']").forEach((field) => {
        field.removeAttribute("aria-invalid");
        updateDescription(field, error?.id, false);
      });
      if (error && error.dataset.defaultMessage) {
        error.textContent = error.dataset.defaultMessage;
      }
    };

    const markFieldError = (field, message) => {
      const group = field.closest(".form__group");
      if (!group) return;
      group.classList.add("form__group--error");
      field.setAttribute("aria-invalid", "true");
      const error = group.querySelector(".form__error");
      updateDescription(field, error?.id, true);
      if (error && message) error.textContent = message;
      if (field.type === "radio") {
        const radioGroup = group.querySelector('[role="radiogroup"]');
        if (radioGroup) {
          radioGroup.setAttribute("aria-invalid", "true");
          updateDescription(radioGroup, error?.id, true);
        }
      }
    };

    const focusFirstError = () => {
      const group = form.querySelector(".form__group--error");
      const field = group?.querySelector("input:not([type='hidden']), select, textarea");
      if (!field) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      field.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
      field.focus({ preventScroll: true });
    };

    form.addEventListener("submit", (e) => {
      if (form.dataset.submitting === "true") {
        e.preventDefault();
        return;
      }

      let valid = true;
      const mailtoRecipient = form.dataset.mailtoRecipient;
      const endpoint = form.dataset.endpoint;

      form.querySelectorAll(".form__group--error").forEach(clearGroupError);
      const status = form.querySelector(".form__status");
      if (status) status.hidden = true;

      // Required fields
      form.querySelectorAll("[required]").forEach((field) => {
        if (field.type === "radio") return;
        if (
          (field.type === "checkbox" && !field.checked) ||
          (field.type !== "checkbox" && !field.value.trim())
        ) {
          valid = false;
          markFieldError(field);
        }
      });

      form.querySelectorAll('input[type="email"]').forEach((email) => {
        if (email.value && email.validity.typeMismatch) {
          valid = false;
          markFieldError(email);
        }
      });

      const radios = form.querySelectorAll('input[type="radio"][required]');
      if (radios.length && !form.querySelector('input[type="radio"]:checked')) {
        valid = false;
        markFieldError(radios[0]);
        const radioGroup = radios[0].closest(".form__group")?.querySelector('[role="radiogroup"]');
        if (radioGroup) radioGroup.setAttribute("aria-invalid", "true");
      }

      form.querySelectorAll('input[type="tel"][required]').forEach((tel) => {
        if (tel.value && !/^\+?[0-9 ()\/\-]{6,25}$/.test(tel.value.trim())) {
          valid = false;
          markFieldError(tel);
        }
      });

      const dateField = form.querySelector("#move_date");
      if (dateField && dateField.value) {
        const selectedDate = new Date(`${dateField.value}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          valid = false;
          markFieldError(dateField);
        }
      }

      if (!valid) {
        e.preventDefault();
        focusFirstError();
        return;
      }

      if (endpoint) {
        e.preventDefault();
        submitForm(form, endpoint);
        return;
      }

      if (mailtoRecipient) {
        e.preventDefault();

        const formData = new FormData(form);
        const serviceLabel = getServiceLabel(form);
        const subject = serviceLabel
          ? `Neue Anfrage: ${serviceLabel}`
          : "Neue Anfrage ueber das Kontaktformular";
        const body = buildMailBody(formData, serviceLabel);

        window.location.href = `mailto:${encodeURIComponent(mailtoRecipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
    });
    const clearOnEdit = (e) => {
      const group = e.target.closest(".form__group");
      if (group) clearGroupError(group);
    };
    form.addEventListener("input", clearOnEdit);
    form.addEventListener("change", clearOnEdit);
  });

  /* ---------- Umzugsfelder & Versand ---------- */
  const moveFieldset = document.getElementById("move-fields");
  const serviceSelect = document.getElementById("service");
  if (moveFieldset && serviceSelect) {
    const moveInputs = moveFieldset.querySelectorAll("input");
    const dateInput = document.getElementById("move_date");
    const getLocalDate = () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return `${today.getFullYear()}-${month}-${day}`;
    };
    if (dateInput) dateInput.min = getLocalDate();
    const toggleMove = () => {
      const isMove = ["umzug", "firmenumzug"].includes(serviceSelect.value);
      moveFieldset.hidden = !isMove;
      moveInputs.forEach((i) => (i.required = isMove));
      if (dateInput) dateInput.required = isMove;
      const dateReq = document.getElementById("date-req");
      const dateLabel = document.getElementById("date-label");
      const dateHelp = document.getElementById("date-help");
      if (dateReq) dateReq.hidden = !isMove;
      if (dateLabel) dateLabel.textContent = isMove ? "Umzugsdatum" : "Wunschtermin (optional)";
      if (dateHelp) {
        dateHelp.textContent = isMove
          ? "Bitte wählen Sie den geplanten Umzugstermin."
          : "Wenn Sie schon einen Wunschtermin haben, können Sie ihn hier angeben.";
      }
    };
    serviceSelect.addEventListener("change", toggleMove);
    toggleMove();
    const params = new URLSearchParams(window.location.search);
    const requestedService = params.get("leistung");
    if (requestedService && Array.from(serviceSelect.options).some((option) => option.value === requestedService)) {
      serviceSelect.value = requestedService;
      toggleMove();
    }
  }
  const tsField = document.querySelector('#contact-form [name="ts"]');
  if (tsField) tsField.value = String(Date.now());

  async function submitForm(form, endpoint) {
    const status = form.querySelector(".form__status");
    const button = form.querySelector('button[type="submit"]');
    const buttonLabel = button?.querySelector(".form__submit-label");
    const originalButtonLabel = buttonLabel?.textContent;
    const show = (text, ok) => {
      if (!status) return;
      status.hidden = false;
      status.textContent = text;
      status.className = "form__status " + (ok ? "form__status--ok" : "form__status--error");
      status.setAttribute("role", ok ? "status" : "alert");
    };
    form.dataset.submitting = "true";
    form.setAttribute("aria-busy", "true");
    form.classList.add("form--submitting");
    if (button) button.disabled = true;
    if (buttonLabel) buttonLabel.textContent = "Wird gesendet …";
    try {
      const res = await fetch(endpoint, { method: "POST", body: new FormData(form) });
      let data;
      try {
        data = await res.json();
      } catch {
        show("Der Server hat keine gültige Antwort geliefert. Bitte versuchen Sie es erneut oder rufen Sie uns an.", false);
        return;
      }
      if (!data || typeof data !== "object") {
        show("Der Server hat keine gültige Antwort geliefert. Bitte versuchen Sie es erneut oder rufen Sie uns an.", false);
        return;
      }
      if (res.ok && data.ok) {
        form.reset();
        form.querySelectorAll(".form__group--error").forEach((group) => {
          group.classList.remove("form__group--error");
          const error = group.querySelector(".form__error");
          group.querySelectorAll("input, select, textarea, [role='radiogroup']").forEach((field) => {
            field.removeAttribute("aria-invalid");
            updateDescription(field, error?.id, false);
          });
          if (error && error.dataset.defaultMessage) {
            error.textContent = error.dataset.defaultMessage;
          }
        });
        if (serviceSelect) serviceSelect.dispatchEvent(new Event("change"));
        if (tsField) tsField.value = String(Date.now());
        show("Vielen Dank! Ihre Anfrage wurde gesendet. Wir melden uns schnellstmöglich bei Ihnen.", true);
      } else {
        if (data.errors) {
          Object.entries(data.errors).forEach(([name, message]) => {
            const field = Array.from(form.elements).find((element) => element.name === name);
            if (field) {
              const group = field.closest(".form__group");
              if (group) {
                group.classList.add("form__group--error");
                const radioGroup = group.querySelector('[role="radiogroup"]');
                const error = group.querySelector(".form__error");
                if (error && typeof message === "string") error.textContent = message;
                updateDescription(field, error?.id, true);
                if (radioGroup) {
                  radioGroup.setAttribute("aria-invalid", "true");
                  updateDescription(radioGroup, error?.id, true);
                }
              }
              field.setAttribute("aria-invalid", "true");
            }
          });
        }
        show(data.message || "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie uns an.", false);
        const firstError = form.querySelector(".form__group--error");
        const firstErrorField = firstError?.querySelector("input:not([type='hidden']), select, textarea");
        if (firstErrorField) {
          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          firstErrorField.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "center",
          });
          firstErrorField.focus({ preventScroll: true });
        }
      }
    } catch {
      show("Verbindungsfehler: Ihre Anfrage wurde nicht gesendet. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut oder rufen Sie uns an.", false);
    } finally {
      if (button) button.disabled = false;
      if (buttonLabel) buttonLabel.textContent = originalButtonLabel;
      form.classList.remove("form--submitting");
      form.removeAttribute("aria-busy");
      delete form.dataset.submitting;
    }
  }
  function getServiceLabel(form) {
    const serviceField = form.querySelector('[name="service"]');
    if (!serviceField || !serviceField.value) return "";

    const selectedOption = serviceField.options[serviceField.selectedIndex];
    return selectedOption ? selectedOption.text.trim() : "";
  }

  function buildMailBody(formData, serviceLabel) {
    const name = (formData.get("name") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const phone = (formData.get("phone") || "").toString().trim();
    const message = (formData.get("message") || "").toString().trim();

    return [
      "Hallo Easy2Moove,",
      "",
      "ich moechte eine Anfrage stellen.",
      "",
      `Name: ${name}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Gewuenschte Leistung: ${serviceLabel || "-"}`,
      "",
      "Nachricht:",
      message,
      "",
      "Viele Gruesse",
      name,
    ].join("\n");
  }

  /* ---------- Lazy Loading fallback ---------- */
  if ("IntersectionObserver" in window) {
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("loaded");
          imgObserver.unobserve(entry.target);
        }
      });
    });
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      if (img.complete) {
        img.classList.add("loaded");
      } else {
        imgObserver.observe(img);
      }
    });
  } else {
    document
      .querySelectorAll('img[loading="lazy"]')
      .forEach((img) => img.classList.add("loaded"));
  }

  /* ---------- Back to Top ---------- */
  const btt = document.querySelector(".back-to-top");
  if (btt) {
    window.addEventListener(
      "scroll",
      () => {
        btt.classList.toggle("back-to-top--visible", window.scrollY > 400);
      },
      { passive: true },
    );
    btt.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  /* ---------- DSGVO Consent Banner ---------- */
  const banner = document.querySelector(".consent-banner");
  if (banner) {
    const bannerText = banner.querySelector(".consent-banner__text");
    const bannerLink = bannerText?.querySelector("a");
    if (bannerText) {
      const heading = document.createElement("h2");
      heading.className = "consent-banner__title";
      heading.textContent = "Ihre Privatsphäre ist uns wichtig";
      banner.querySelector(".consent-banner__inner")?.prepend(heading);
      bannerText.replaceChildren(
        "Wir setzen keine Analyse- oder Marketing-Cookies ein. Nur Ihre Auswahl, diesen Hinweis zu schließen, speichern wir lokal, damit er nicht erneut erscheint.",
      );
      if (bannerLink) {
        bannerText.append(" ", bannerLink);
      }
    }

    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Datenschutzhinweis");

    if (
      localStorage.getItem("privacy_notice_dismissed") !== "true" &&
      localStorage.getItem("consent_accepted") === null
    ) {
      banner.classList.add("consent-banner--visible");
    }
    const dismissBtn = banner.querySelector('[data-consent="accept"]');
    banner.querySelector('[data-consent="decline"]')?.remove();
    if (dismissBtn) {
      dismissBtn.setAttribute("data-consent", "dismiss");
      dismissBtn.textContent = "Alles klar";
      dismissBtn.setAttribute("aria-label", "Datenschutzhinweis schließen");
    }

    dismissBtn?.addEventListener("click", () => {
      localStorage.setItem("privacy_notice_dismissed", "true");
      banner.classList.remove("consent-banner--visible");
    });
  }

  /* ---------- Smooth scroll for anchor links ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* ---------- Process Timeline Animation ---------- */
  const processEl = document.getElementById("process-timeline");
  if (processEl && "IntersectionObserver" in window) {
    const processObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            processEl.classList.add("animate");
            processObs.unobserve(processEl);
          }
        });
      },
      { threshold: 0.3 },
    );
    processObs.observe(processEl);
  }

  /* ---------- Scroll Reveal Animation ---------- */
  if ("IntersectionObserver" in window) {
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--visible");
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => revealObs.observe(el));
  } else {
    document
      .querySelectorAll(".reveal")
      .forEach((el) => el.classList.add("reveal--visible"));
  }
});

/* ============================================================
   START: SECTION 1 – HERO SCROLL-FUNKTION
   ============================================================ */

(function () {
  "use strict";

  const hero = document.querySelector(".e2m-hero");

  if (!hero) return;

  const scrollLink = hero.querySelector(".e2m-hero__scroll");

  if (!scrollLink) return;

  scrollLink.addEventListener("click", function (event) {
    const targetId = this.getAttribute("href");

    if (!targetId || !targetId.startsWith("#")) {
      return;
    }

    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  });
})();

/* ============================================================
   ENDE: SECTION 1 – HERO SCROLL-FUNKTION
   ============================================================ */

// ============================================================
// START: EASY2MOOVE – PROCESS TIMELINE ANIMATION
// ============================================================

(() => {
  const timeline = document.querySelector("#process-timeline");

  if (!timeline) return;

  const steps = timeline.querySelectorAll(".process-step");

  if (!steps.length) return;

  const showTimeline = () => {
    timeline.classList.add("is-visible");

    steps.forEach((step) => {
      step.classList.add("is-visible");
    });
  };

  // Inhalte bei reduzierten Bewegungseffekten sofort anzeigen.
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    showTimeline();
    return;
  }

  // Animation nur einmal auslösen, sobald der Bereich
  // sichtbar wird.
  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        showTimeline();
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -35px 0px",
    },
  );

  observer.observe(timeline);
})();

// ============================================================
// ENDE: EASY2MOOVE – PROCESS TIMELINE ANIMATION
// ============================================================

/* ============================================================
   START: EASY2MOOVE – REZENSIONEN-SLIDER
   ============================================================ */
(() => {
  "use strict";

  const root = document.getElementById("e2m-reviews-slider");
  const track = document.getElementById("e2m-reviews-track");
  const dotsContainer = document.getElementById("e2m-reviews-dots");
  const counter = document.getElementById("e2m-reviews-counter");
  const playButton = document.getElementById("e2m-reviews-play");
  const previousButton = root?.querySelector(".e2m-reviews__arrow--prev");
  const nextButton = root?.querySelector(".e2m-reviews__arrow--next");

  if (
    !root ||
    !track ||
    !dotsContainer ||
    !counter ||
    !playButton ||
    !previousButton ||
    !nextButton
  )
    return;

  /*
    highlight = wichtigste Aussage in Grün
    text      = übriger Rezensionstext, kursiv
    Die Hervorhebung wird manuell festgelegt.
  */
  const reviews = [
    {
      name: "Mufeez Jathol",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Die Besichtigung lief reibungslos.",
      text: "Mein allererster Umzug und ich war mir nicht wirklich sicher, wen ich kontaktieren sollte. Ich habe dieses Unternehmen als Erstes kontaktiert. Auch beim Preis konnte ich mich unmöglich beschweren – deshalb 5 Sterne!",
    },
    {
      name: "Jamal Moiz",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Mit Abstand die beste Wahl.",
      text: "Top Service zu einem wirklich fairen Preis. Ich hatte mehrere Angebote verglichen und Easy2moove war mit Abstand die beste Wahl. Alles lief reibungslos. Ich kann das Unternehmen nur weiterempfehlen.",
    },
    {
      name: "Ingrid Zöller",
      date: "vor 5 Monaten",
      rating: 5,
      highlight: "Sorgfältig, zuverlässig und ein echtes Traumteam.",
      text: "So starke und hilfsbereite Männer habe ich schon lange nicht mehr erlebt. Sie haben meine Möbel mit unglaublicher Leichtigkeit getragen. Alles wurde sorgfältig und zuverlässig in die neue Wohnung gebracht. Das Preis-Leistungs-Verhältnis war unschlagbar. Vielen Dank für den tollen Service!",
    },
    {
      name: "Ahmed Nabeel",
      date: "vor 5 Monaten",
      rating: 5,
      highlight: "Äußerst freundlich und professionell.",
      text: "Ich bin absolut begeistert von diesem Unternehmen! Die Mitarbeiter sind äußerst freundlich und professionell. Besonders die Gespräche mit den Kunden verlaufen stets reibungslos und angenehm. Sehr zu empfehlen!",
    },
    {
      name: "Natalia",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Gute und saubere Arbeitsweise.",
      text: "Ich bin sehr zufrieden mit dem Team. Empfehlenswert und zuverlässige Arbeiter.",
    },
    {
      name: "Tayyab Ghumman (TG)",
      date: "vor 5 Monaten",
      rating: 5,
      highlight: "Vom ersten Kontakt bis zum Abschluss professionell.",
      text: "Das Team war pünktlich, freundlich und sehr sorgfältig im Umgang mit meinen Möbeln und persönlichen Gegenständen. Insbesondere der Abbau der Möbel war sehr professionell und zügig. Klare Empfehlung für alle, die einen zuverlässigen und kompetenten Umzugsservice suchen!",
    },
    {
      name: "Javad Sh7",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Zuverlässiger Service und sorgfältiger Transport.",
      text: "Freundliche Mitarbeiter und ein sehr gutes Preis-Leistungs-Verhältnis. Klare Empfehlung!",
    },
    {
      name: "Torsten",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Die Lieferungen kamen rechtzeitig an.",
      text: "Ich bin sehr zufrieden mit diesem Transportunternehmen. Die Mitarbeiter haben sehr sorgfältig gearbeitet.",
    },
    {
      name: "Salvatore Di Franco",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Pünktlich angekommen.",
      text: "Sehr tolle Mitarbeiter. Sie sind beide Male rechtzeitig angekommen.",
    },
    {
      name: "Martin Lazic",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Sehr schneller Kontakt und schneller Transport.",
      text: "Sehr empfehlenswert.",
    },
    {
      name: "Furkan Bayrak",
      date: "vor einem Monat",
      rating: 5,
      highlight: "Lustiges TikTok-Video.",
      text: "Deswegen 5 Sterne.",
    },
    {
      name: "Nikos Rothschenk",
      date: "vor 3 Tagen",
      rating: 5,
      highlight: "Super Service, sehr nette Mitarbeiter.",
      text: "Kann ich nur weiterempfehlen! Bei meinem nächsten Umzug weiß ich, wen ich anrufe.",
    },
    {
      name: "Faheem Ahmad",
      date: "vor 3 Wochen",
      rating: 5,
      highlight: "Den ganzen Umzug organisiert und durchgeführt.",
      text: "Super Service, bin vollkommen zufrieden. Die Herrschaften haben meinen ganzen Umzug organisiert und durchgeführt. Preis-Leistung top!",
    },
    {
      name: "Lilli Funk",
      date: "vor einem Monat",
      rating: 5,
      highlight: "Noch am selben Tag einen Termin bekommen.",
      text: "Super freundlich!",
    },
    {
      name: "Vera K.",
      date: "vor einem Monat",
      rating: 5,
      highlight:
        "Keine Kratzer, keine versteckten Kosten – ein faires Angebot.",
      text: "Die Planung im Vorfeld war professionell, der Umzug selbst lief sehr effizient ab. Das Team war pünktlich und hat bei empfindlichen Massivholzmöbeln besonders gut aufgepasst. Alles wurde ordentlich eingepackt und kam ohne Kratzer an. Trotz eines extrem engen Treppenhauses wurden die schweren Sachen sicher transportiert. Zuverlässig, schnell und ein fairer Preis.",
    },
    {
      name: "Opal Harrison",
      date: "vor einem Monat",
      rating: 5,
      highlight: "Friendly communication and great help.",
      text: "I was so happy to find this company to help me move some things to storage before long-term travel. They moved everything from my apartment into the van and then into storage. It was a relief to get great help. I would recommend them for any moves.",
    },
    {
      name: "Landeskriminalamt Berlin",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Auf Easy2Moove durch TikTok aufmerksam geworden.",
      text: "+Reputation (bin von TikTok).",
    },
    {
      name: "Karin Aidi",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Reibungslose Abwicklung ohne Probleme.",
      text: "Sehr freundlicher Kontakt. Sehr zu empfehlen.",
    },
    {
      name: "Saboor Atta Ul",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Zuverlässig und mit Leidenschaft bei der Arbeit.",
      text: "Sehr zuverlässige und gute Mitarbeiter, die hart und mit Leidenschaft arbeiten. Kann ich nur weiterempfehlen.",
    },
    {
      name: "Amanuel Godie",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "Pünktlich und professionell.",
      text: "Die Mitarbeiter machen ihre Arbeit sehr professionell.",
    },
    {
      name: "Nina Weinstabl",
      date: "vor einem Monat",
      rating: 5,
      highlight: "",
      text: "",
    },
    {
      name: "Andreas",
      date: "vor einem Monat",
      rating: 5,
      highlight: "",
      text: "",
    },
    {
      name: "Lucas Herzog",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "",
      text: "",
    },
    {
      name: "Endocryne",
      date: "vor 2 Monaten",
      rating: 5,
      highlight: "",
      text: "",
    },
  ];

  let currentIndex = 0;
  let timer = null;
  let isPaused = false;
  let pointerStartX = null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobileQuery = window.matchMedia("(max-width: 600px)");

  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function createCard(review, index) {
    const card = element("article", "e2m-review-card");
    card.dataset.index = String(index);

    const top = element("div", "e2m-review-card__top");
    const avatar = element(
      "div",
      "e2m-review-card__avatar",
      review.name.trim().charAt(0) || "G",
    );
    avatar.setAttribute("aria-hidden", "true");

    const identity = element("div", "e2m-review-card__identity");
    identity.append(
      element("span", "e2m-review-card__name", review.name),
      element("span", "e2m-review-card__date", review.date),
    );

    const google = element("span", "e2m-review-card__google", "G");
    google.setAttribute("aria-label", "Google");
    top.append(avatar, identity, google);

    const rating = element("div", "e2m-review-card__rating");
    const stars = element(
      "span",
      "e2m-review-card__stars",
      "★".repeat(review.rating) + "☆".repeat(5 - review.rating),
    );
    stars.setAttribute("aria-label", `${review.rating} von 5 Sternen`);

    rating.append(
      stars,
      element("span", "e2m-review-card__verified", "Google-Rezension"),
    );

    const content = element("div", "e2m-review-card__content");

    if (review.highlight) {
      content.appendChild(
        element("strong", "e2m-review-card__highlight", review.highlight),
      );
    }

    if (review.text) {
      content.appendChild(element("p", "e2m-review-card__text", review.text));
    } else if (!review.highlight) {
      content.appendChild(
        element(
          "p",
          "e2m-review-card__text e2m-review-card__text--empty",
          "Für diese Rezension wurde kein Text veröffentlicht.",
        ),
      );
    }

    const bottom = element("div", "e2m-review-card__bottom");
    bottom.append(
      element("span", "", "Kundenstimme"),
      element("span", "e2m-review-card__quote", "”"),
    );

    card.append(top, rating, content, bottom);
    return card;
  }

  function renderCards() {
    const cardsFragment = document.createDocumentFragment();
    const dotsFragment = document.createDocumentFragment();

    reviews.forEach((review, index) => {
      cardsFragment.appendChild(createCard(review, index));

      const dot = element("button", "e2m-reviews__dot");
      dot.type = "button";
      dot.setAttribute("aria-label", `Rezension ${index + 1}: ${review.name}`);
      dot.addEventListener("click", () => {
        goTo(index);
        restartTimer();
      });
      dotsFragment.appendChild(dot);
    });

    track.replaceChildren(cardsFragment);
    dotsContainer.replaceChildren(dotsFragment);
  }

  function updateSlider() {
    const cards = [...track.children];
    const dots = [...dotsContainer.children];
    const total = reviews.length;

    cards.forEach((card, index) => {
      const distance = (index - currentIndex + total) % total;
      const active = index === currentIndex;
      card.classList.toggle("e2m-review-card--active", active);

      const visible = mobileQuery.matches
        ? active
        : distance === 0 || distance === 1 || distance === total - 1;

      card.hidden = !visible;
      card.style.order =
        distance === total - 1 ? "-1" : distance === 0 ? "0" : "1";
      card.setAttribute("aria-label", `Rezension ${index + 1} von ${total}`);
    });

    dots.forEach((dot, index) => {
      dot.setAttribute(
        "aria-current",
        index === currentIndex ? "true" : "false",
      );
    });

    counter.textContent = `${currentIndex + 1} / ${total}`;
  }

  function goTo(index) {
    currentIndex = (index + reviews.length) % reviews.length;
    updateSlider();
  }

  function stopTimer() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (isPaused || reduceMotion.matches || document.hidden) return;
    timer = window.setInterval(() => goTo(currentIndex + 1), 3000);
  }

  function restartTimer() {
    startTimer();
  }

  function updatePlayButton() {
    const icon = playButton.querySelector(".e2m-reviews__play-icon");
    const label = playButton.querySelector(".e2m-reviews__play-label");

    icon.textContent = isPaused ? "▶" : "Ⅱ";
    label.textContent = isPaused
      ? "Automatischen Wechsel starten"
      : "Automatischen Wechsel pausieren";
    playButton.setAttribute("aria-pressed", String(isPaused));
  }

  previousButton.addEventListener("click", () => {
    goTo(currentIndex - 1);
    restartTimer();
  });

  nextButton.addEventListener("click", () => {
    goTo(currentIndex + 1);
    restartTimer();
  });

  playButton.addEventListener("click", () => {
    isPaused = !isPaused;
    updatePlayButton();
    startTimer();
  });

  root.addEventListener("mouseenter", stopTimer);
  root.addEventListener("mouseleave", startTimer);
  root.addEventListener("focusin", stopTimer);
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget)) startTimer();
  });

  root.addEventListener(
    "touchstart",
    (event) => {
      pointerStartX = event.changedTouches[0].clientX;
    },
    { passive: true },
  );

  root.addEventListener(
    "touchend",
    (event) => {
      if (pointerStartX === null) return;

      const difference = event.changedTouches[0].clientX - pointerStartX;
      pointerStartX = null;

      if (Math.abs(difference) > 45) {
        goTo(currentIndex + (difference < 0 ? 1 : -1));
        restartTimer();
      }
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", startTimer);

  function handleMotionChange() {
    startTimer();
  }

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", handleMotionChange);
  } else {
    reduceMotion.addListener(handleMotionChange);
  }

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener("change", updateSlider);
  } else {
    mobileQuery.addListener(updateSlider);
  }

  renderCards();
  updateSlider();
  updatePlayButton();
  startTimer();
})();
/* ==================== ENDE: REZENSIONEN-SLIDER ==================== */
