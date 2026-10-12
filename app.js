const { useState, useMemo, createElement } = React;
const html = htm.bind(createElement);

const TYPE_LABEL = {
  medicament_organe: "Médicament + organe",
  medicament_medicament: "Médicament + médicament",
  medicament_humain: "Médicament + humain",
};

const pairKey = (a, b) => [a, b].sort().join("|");
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const CATEGORIE = {
  benefique: ["Bénéfique", "cat-benefique"],
  effet_secondaire: ["Effet secondaire", "cat-effet"],
  risque: ["Risque", "cat-risque"],
  neutre: ["Neutre", "cat-neutre"],
};

function Fiche({ c, nameOf }) {
  const [a, b] = c.elements;
  const risque = c.categorie_resultat === "risque" || (c.type === "medicament_medicament" && /^RISQUE/.test(c.resultat));
  const cat = CATEGORIE[c.categorie_resultat];
  return html`
    <article class=${"fiche " + (risque ? "risque" : "")}>
      <div class="fiche-titre">
        <span>${nameOf(a)} + ${nameOf(b)}</span>
        <span>
          ${cat && html`<span class=${"badge " + cat[1]}>${cat[0]}</span> `}
          <span class=${"badge " + c.niveau_certitude}>${c.niveau_certitude === "confirme" ? "Confirmé" : "À VALIDER"}</span>
        </span>
      </div>
      <p class="type">${TYPE_LABEL[c.type]}</p>
      <p><strong>Résultat :</strong> ${c.resultat}</p>
      <p><strong>Mécanisme :</strong> ${c.mecanisme}</p>
      ${c.effets_indesirables && html`<p><strong>Effets indésirables :</strong> ${c.effets_indesirables}</p>`}
      ${c.interactions && html`<p><strong>Interactions :</strong> ${c.interactions}</p>`}
      ${c.populations_a_risque && html`<p><strong>Populations à risque :</strong> ${c.populations_a_risque}</p>`}
      ${c.niveau_certitude === "a_valider" && html`<p class="alerte">Cette fiche n'a pas encore été validée par un pharmacien.</p>`}
      <p class="source">Source : ${c.source}</p>
    </article>
  `;
}

function Tuile({ el, selected, count, onPick, onDragStart }) {
  const done = count && count.found === count.total;
  return html`
    <button class=${"tuile " + (selected ? "sel " : "") + (done ? "complet" : "")} draggable="true"
      onClick=${() => onPick(el.id)} onDragStart=${(e) => onDragStart(e, el.id)} title=${el.classe || ""}>
      <span class="emoji">${el.emoji}</span>
      <span>${el.nom}</span>
      ${count && html`<small class="compteur">${done ? "✔ " : ""}${count.found}/${count.total}</small>`}
    </button>
  `;
}

function Quiz({ data, found, nameOf }) {
  const pool = data.combinaisons.filter((c) => found.includes(c.id));
  const [q, setQ] = useState(null);
  const [choice, setChoice] = useState(null);
  const [score, setScore] = useState({ ok: 0, n: 0 });

  function next() {
    const c = pool[Math.floor(Math.random() * pool.length)];
    const same = pool.filter((x) => x.id !== c.id && x.type === c.type);
    const others = shuffle(same.length >= 3 ? same : pool.filter((x) => x.id !== c.id)).slice(0, 3);
    setQ({ c, options: shuffle([c, ...others]) });
    setChoice(null);
  }

  if (pool.length < 4)
    return html`<p class="aide">Découvrez au moins 4 fiches pour débloquer le quiz (${pool.length}/4).</p>`;
  if (!q) return html`<div><p class="aide">Retrouvez la combinaison qui correspond à la description, parmi vos découvertes.</p><button class="primaire" onClick=${next}>Commencer</button></div>`;

  const label = (c) => `${nameOf(c.elements[0])} + ${nameOf(c.elements[1])}`;
  return html`
    <div>
      <p class="aide">Score : ${score.ok} / ${score.n}</p>
      <div class="question">
        <p><strong>${q.c.resultat}</strong></p>
        <p>${q.c.mecanisme}</p>
      </div>
      <div class="options">
        ${q.options.map((o) => html`
          <button key=${o.id} disabled=${choice !== null}
            class=${"option " + (choice !== null ? (o.id === q.c.id ? "bon" : o.id === choice ? "mauvais" : "") : "")}
            onClick=${() => { setChoice(o.id); setScore((s) => ({ ok: s.ok + (o.id === q.c.id ? 1 : 0), n: s.n + 1 })); }}>
            ${label(o)}
          </button>`)}
      </div>
      ${choice !== null && html`
        <p class="message">${choice === q.c.id ? "✅ Bonne réponse !" : "❌ Pas tout à fait : c'était " + label(q.c) + "."}</p>
        <button class="primaire" onClick=${next}>Question suivante</button>`}
    </div>
  `;
}

function App({ data }) {
  const [sel, setSel] = useState([]);
  const [found, setFound] = useState([]); // état en mémoire seulement
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("jeu");
  const [filter, setFilter] = useState("tous");
  const [category, setCategory] = useState("tout");
  const [query, setQuery] = useState("");
  const [carnetQuery, setCarnetQuery] = useState("");
  const [hint, setHint] = useState(null);

  const elements = useMemo(() => {
    const m = {};
    [...data.medicaments, ...data.organes, data.humain].forEach((e) => (m[e.id] = e));
    return m;
  }, [data]);
  const medIds = useMemo(() => new Set(data.medicaments.map((m) => m.id)), [data]);
  const index = useMemo(() => {
    const m = {};
    data.combinaisons.forEach((c) => (m[pairKey(...c.elements)] = c));
    return m;
  }, [data]);
  const nameOf = (id) => elements[id].nom;

  const total = data.combinaisons.length;
  const pct = Math.round((found.length / total) * 100);
  const aValider = data.combinaisons.filter((c) => c.niveau_certitude === "a_valider").length;

  const counts = useMemo(() => {
    const m = {};
    data.combinaisons.forEach((c) =>
      c.elements.forEach((id) => {
        m[id] = m[id] || { found: 0, total: 0 };
        m[id].total++;
        if (found.includes(c.id)) m[id].found++;
      }));
    return m;
  }, [data, found]);

  const MAX_SEL = 6;
  const TYPE_ORDER = { medicament_humain: 0, medicament_organe: 1, medicament_medicament: 2 };

  function toggle(id) {
    setHint(null);
    setResult(null);
    if (sel.includes(id)) { setMessage(null); setSel(sel.filter((x) => x !== id)); return; }
    const isOrgan = id !== "humain" && !medIds.has(id);
    if ((id === "humain" && sel.some((x) => x !== "humain" && !medIds.has(x))) || (isOrgan && sel.includes("humain"))) {
      setMessage("« Humain » représente déjà tous les organes et systèmes : on ne peut pas le combiner avec un organe ou un système. Retirez l'un des deux.");
      return;
    }
    if (sel.length >= MAX_SEL) { setMessage(`Maximum ${MAX_SEL} éléments dans l'atelier.`); return; }
    setMessage(null);
    setSel([...sel, id]);
  }

  function combine() {
    setHint(null);
    if (sel.length < 2) { setResult(null); setMessage("Choisissez au moins deux éléments."); return; }
    if (!sel.some((id) => medIds.has(id))) { setResult(null); setMessage("Ajoutez au moins un médicament : les organes et systèmes ne réagissent pas entre eux dans ce jeu."); return; }
    const fiches = [];
    const manquantes = [];
    for (let i = 0; i < sel.length; i++)
      for (let j = i + 1; j < sel.length; j++) {
        const [a, b] = [sel[i], sel[j]];
        if (!medIds.has(a) && !medIds.has(b)) continue;
        const c = index[pairKey(a, b)];
        c ? fiches.push(c) : manquantes.push([a, b]);
      }
    fiches.sort((x, y) => TYPE_ORDER[x.type] - TYPE_ORDER[y.type]);
    const nouvelles = fiches.filter((c) => !found.includes(c.id));
    if (nouvelles.length) setFound((f) => [...f, ...nouvelles.map((c) => c.id)]);
    setResult({ fiches, manquantes, nouvelles: nouvelles.length, nbMeds: sel.filter((id) => medIds.has(id)).length });
    setMessage(null);
  }

  function giveHint() {
    const left = data.combinaisons.filter((c) => !found.includes(c.id));
    if (!left.length) { setHint("Bravo, vous avez tout découvert !"); return; }
    const c = left[Math.floor(Math.random() * left.length)];
    const [m, other] = medIds.has(c.elements[0]) ? c.elements : [c.elements[1], c.elements[0]];
    const kind = medIds.has(other) ? "un autre médicament" : other === "humain" ? "le corps entier" : "un organe ou un système";
    setHint(`💡 Essayez ${nameOf(m)} avec ${kind}.`);
  }

  function reset() {
    if (window.confirm("Effacer toute la progression ?")) { setFound([]); setSel([]); setResult(null); setMessage(null); setHint(null); }
  }

  const onDragStart = (e, id) => e.dataTransfer.setData("text/plain", id);
  const onDrop = (e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (elements[id] && !sel.includes(id)) toggle(id); };
  const clear = () => { setSel([]); setResult(null); setMessage(null); };

  const missing = useMemo(() => {
    const out = { medicament_humain: [], medicament_organe: [], medicament_medicament: [] };
    const meds = data.medicaments;
    meds.forEach((m, i) => {
      [data.humain, ...data.organes].forEach((o) => {
        if (!index[pairKey(m.id, o.id)]) out[o.id === "humain" ? "medicament_humain" : "medicament_organe"].push([m.id, o.id]);
      });
      meds.slice(i + 1).forEach((m2) => { if (!index[pairKey(m.id, m2.id)]) out.medicament_medicament.push([m.id, m2.id]); });
    });
    return out;
  }, [data, index]);
  const missingTotal = Object.values(missing).reduce((n, l) => n + l.length, 0);

  function copyMissing() {
    const lines = [];
    Object.entries(missing).forEach(([t, l]) => {
      lines.push(`# ${TYPE_LABEL[t]} (${l.length})`);
      l.forEach(([a, b]) => lines.push(`- ${nameOf(a)} + ${nameOf(b)}`));
    });
    (data.suggestions_a_ajouter ? Object.entries(data.suggestions_a_ajouter.elements) : []).forEach(([k, l]) => {
      lines.push(`# Éléments suggérés : ${k}`);
      l.forEach((x) => lines.push(`- ${x}`));
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const q = norm(query);
  const matches = (el) => !q || norm(el.nom).includes(q) || norm(el.classe || "").includes(q);
  const groups = [
    ["Médicaments", data.medicaments, "medicament"],
    ["Organes et systèmes", data.organes, "organe"],
    ["Corps entier", [data.humain], "organe"],
  ].filter(([, , cat]) => category === "tout" || category === cat)
   .map(([t, l, c]) => [t, l.filter(matches), c]).filter(([, l]) => l.length);

  const cq = norm(carnetQuery);
  const carnet = data.combinaisons.filter((c) => found.includes(c.id))
    .filter((c) => filter === "tous" || (filter === "a_valider" ? c.niveau_certitude === "a_valider" : c.type === filter))
    .filter((c) => !cq || norm(c.elements.map(nameOf).join(" ") + " " + c.resultat + " " + c.mecanisme).includes(cq));

  const stats = Object.keys(TYPE_LABEL).map((t) => {
    const all = data.combinaisons.filter((c) => c.type === t);
    return [TYPE_LABEL[t], all.filter((c) => found.includes(c.id)).length, all.length];
  });

  const tab = (v, label) => html`<button class=${view === v ? "on" : ""} onClick=${() => setView(v)}>${label}</button>`;

  return html`
    <div class="app">
      <header>
        <h1>💊 ${data.meta.titre}</h1>
        <p class="sous-titre">Découvrez comment les médicaments en vente libre agissent dans le corps — sans jouer au médecin.</p>
        <div class="progress" aria-label="Progression">
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}><div class="fill" style=${{ width: pct + "%" }}></div></div>
          <span>${found.length} / ${total} découvertes (${pct} %)</span>
        </div>
        <nav>
          ${tab("jeu", "🧪 Jeu")}${tab("carnet", `📖 Carnet (${found.length})`)}${tab("quiz", "🎯 Quiz")}${tab("manquant", `📝 À compléter (${missingTotal})`)}${tab("about", "ℹ️ À propos")}
        </nav>
      </header>

      ${view === "jeu" && html`
        <main>
          <section class="atelier">
            <p class="aide">Cliquez (ou glissez) 2 à ${MAX_SEL} éléments dans l'atelier : plusieurs médicaments, plusieurs organes ou systèmes. « Humain » = tous les organes à la fois, donc il ne se combine pas avec un organe.</p>
            <div class=${"zone " + (sel.length ? "pleine" : "")} onDragOver=${(e) => e.preventDefault()} onDrop=${onDrop}>
              ${sel.length === 0 && html`<span class="vide">Déposez vos éléments ici</span>`}
              ${sel.map((id, i) => html`
                <${React.Fragment} key=${id}>
                  ${i > 0 && html`<span class="plus">+</span>`}
                  <button class="chip" onClick=${() => toggle(id)} title="Toucher pour retirer">
                    <span class="emoji">${elements[id].emoji}</span><span>${nameOf(id)}</span><small>✕</small>
                  </button>
                <//>`)}
            </div>
            <div class="actions">
              <button class="primaire" onClick=${combine} disabled=${sel.length < 2}>🔬 Combiner</button>
              <button class="reset" onClick=${clear}>Vider l'atelier</button>
              <button class="reset" onClick=${giveHint}>💡 Indice</button>
            </div>
            ${hint && html`<p class="message">${hint}</p>`}
            ${message && html`<p class="message" role="status">${message}</p>`}
            ${result && html`
              <div role="status">
                <p class="message">
                  ${result.nouvelles ? `✨ ${result.nouvelles} nouvelle(s) découverte(s) ajoutée(s) au carnet.` : "Rien de nouveau : tout est déjà dans votre carnet."}
                  ${result.fiches.length === 0 ? " Aucune fiche pour cette combinaison dans le jeu." : ` ${result.fiches.length} fiche(s) trouvée(s).`}
                </p>
                ${result.nbMeds >= 3 && html`<p class="alerte">Les fiches décrivent les paires. Les effets combinés de 3 médicaments ou plus ne sont pas couverts par le jeu : demandez à un pharmacien.</p>`}
                ${result.fiches.map((c) => html`<${Fiche} key=${c.id} c=${c} nameOf=${nameOf} />`)}
                ${result.manquantes.length > 0 && html`
                  <div class="manquantes">
                    <strong>Paires sans fiche dans le jeu :</strong>
                    <ul>${result.manquantes.map(([a, b]) => html`<li key=${a + b}>${nameOf(a)} + ${nameOf(b)}</li>`)}</ul>
                    <small>Cela ne veut pas dire qu'il n'y a aucun effet ou interaction : demandez à un pharmacien.</small>
                  </div>`}
              </div>`}
          </section>

          <section class="palette">
            <input class="recherche" type="search" placeholder="Rechercher un élément…" value=${query}
              onInput=${(e) => setQuery(e.target.value)} aria-label="Rechercher un élément" />
            <div class="filtres">
              ${[["tout", "Tout"], ["medicament", "Médicaments"], ["organe", "Corps"]].map(([k, l]) => html`
                <button key=${k} class=${category === k ? "on" : ""} onClick=${() => setCategory(k)}>${l}</button>`)}
            </div>
            ${groups.length === 0 && html`<p class="aide">Aucun élément trouvé.</p>`}
            ${groups.map(([titre, list]) => html`
              <h2 key=${titre}>${titre}</h2>
              <div class="grille">
                ${list.map((el) => html`<${Tuile} key=${el.id} el=${el} count=${counts[el.id]} selected=${sel.includes(el.id)}
                  onPick=${toggle} onDragStart=${onDragStart} />`)}
              </div>`)}
          </section>
        </main>`}

      ${view === "manquant" && html`
        <main class="carnet">
          <h2>À compléter : ce qui manque</h2>
          <p class="aide">Liste des combinaisons sans fiche (${missingTotal}) et des ${aValider} fiches « a_valider ». Pour le pharmacien réviseur ou le développeur.</p>
          <button class="reset" onClick=${copyMissing}>${copied ? "✔ Copié" : "📋 Copier la liste"}</button>
          ${Object.entries(missing).map(([t, l]) => html`
            <details key=${t} open=${t !== "medicament_humain"}>
              <summary><strong>${TYPE_LABEL[t]}</strong> : ${l.length} manquante(s)</summary>
              ${l.length === 0 ? html`<p class="aide">Rien ne manque ✔</p>` : html`<ul class="liste">${l.map(([a, b]) => html`<li key=${a + b}>${nameOf(a)} + ${nameOf(b)}</li>`)}</ul>`}
            </details>`)}
          <details>
            <summary><strong>Fiches « a_valider »</strong> : ${aValider}</summary>
            <ul class="liste">${data.combinaisons.filter((c) => c.niveau_certitude === "a_valider").map((c) => html`<li key=${c.id}>${nameOf(c.elements[0])} + ${nameOf(c.elements[1])}</li>`)}</ul>
          </details>
          ${data.suggestions_a_ajouter && html`
            <details>
              <summary><strong>Éléments suggérés à ajouter</strong> (non inclus)</summary>
              <p class="aide">${data.suggestions_a_ajouter.note}</p>
              ${Object.entries(data.suggestions_a_ajouter.elements).map(([k, l]) => html`
                <p key=${k}><strong>${k} :</strong> ${l.join(", ")}</p>`)}
            </details>`}
        </main>`}

      ${view === "carnet" && html`
        <main class="carnet">
          <h2>Carnet de découvertes</h2>
          <ul class="stats">${stats.map(([l, a, b]) => html`<li key=${l}>${l} : <strong>${a}/${b}</strong></li>`)}</ul>
          <input class="recherche" type="search" placeholder="Rechercher dans le carnet…" value=${carnetQuery}
            onInput=${(e) => setCarnetQuery(e.target.value)} aria-label="Rechercher dans le carnet" />
          <div class="filtres">
            ${[["tous", "Tous"], ...Object.entries(TYPE_LABEL), ["a_valider", "À VALIDER"]].map(([k, l]) => html`
              <button key=${k} class=${filter === k ? "on" : ""} onClick=${() => setFilter(k)}>${l}</button>`)}
          </div>
          ${carnet.length === 0 && html`<p class="aide">Aucune fiche à afficher. Retournez au jeu !</p>`}
          ${carnet.map((c) => html`<${Fiche} key=${c.id} c=${c} nameOf=${nameOf} />`)}
          <p class="aide">La progression est conservée seulement tant que la page reste ouverte.</p>
        </main>`}

      ${view === "quiz" && html`<main class="carnet"><h2>Quiz</h2><${Quiz} data=${data} found=${found} nameOf=${nameOf} /></main>`}

      ${view === "about" && html`
        <main class="carnet">
          <h2>À propos</h2>
          <p>Jeu éducatif sur le fonctionnement général de médicaments en vente libre au Québec. Il ne donne ni dose, ni conseil personnalisé.</p>
          <p><strong>Pour le pharmacien réviseur :</strong> tout le contenu se trouve dans <code>contenu.json</code> (fiches relues) et <code>contenu_brouillons.json</code> et <code>contenu_extension.json</code> (nouveaux médicaments, organes et fiches, tous non validés). Sur ${total} fiches, <strong>${aValider}</strong> sont marquées « a_valider ». Pour valider une fiche, corrigez le texte puis passez <code>niveau_certitude</code> à <code>confirme</code> (idéalement en la déplaçant dans contenu.json).</p>
          <h2>Sources</h2>
          <ul>${Object.entries(data.sources).map(([k, v]) => html`<li key=${k}><strong>${k}</strong> : ${v}</li>`)}</ul>
          <button class="reset" onClick=${reset}>Réinitialiser la progression</button>
        </main>`}

      <footer role="note">⚕️ ${data.meta.avertissement}</footer>
    </div>
  `;
}

Promise.all([
  fetch("contenu.json").then((r) => r.json()),
  fetch("contenu_brouillons.json").then((r) => r.json()).catch(() => ({ combinaisons: [] })),
  fetch("contenu_extension.json").then((r) => r.json()).catch(() => ({ medicaments: [], organes: [], combinaisons: [] })),
])
  .then(([data, brouillons, ext]) => {
    data.medicaments = [...data.medicaments, ...ext.medicaments];
    data.organes = [...data.organes, ...ext.organes];
    data.combinaisons = [...data.combinaisons, ...brouillons.combinaisons, ...ext.combinaisons];
    ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} data=${data} />`);
  })
  .catch(() => {
    document.getElementById("root").textContent =
      "Impossible de charger contenu.json. Lancez un petit serveur local : python3 -m http.server";
  });
