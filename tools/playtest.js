// Browser-console bot: plays Petronius (home mode) from the current screen to an ending.
// Paste into the console on http://localhost:5173/web/ after starting a new game. Returns a log.
// On-site mode: fakes the GPS position at each destination. Strategy: first choice; journal clues answered from clues.json; correct puzzle answers; say voice keywords only once learned; prefer unvisited leads.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { flow } = petronius;
  const log = [];
  for (let i = 0; i < 4000; i++) {
    await sleep(15);
    const st = petronius.state();
    if (document.querySelector('.ending')) { log.push('ENDING ' + st.ending + ' on day ' + st.day + ' after ' + st.log.length + ' scenes'); break; }
    const dests = [...document.querySelectorAll('.next .dest')];
    if (dests.length) {
      const visited = new Set(st.log.map((v) => v.scene));
      const pick = dests.find((d) => !visited.has(d.dataset.scene)) ?? dests[0];
      if (st.mode === 'onsite' && !pick.classList.contains('btn-primary')) {
        // On site: walk (teleport) to the place, then wait for the button to unlock.
        const p = flow.places[flow.scenes[pick.dataset.scene].place];
        petronius.fakePosition(p.lat + 0.0001, p.lng, 12);
        continue;
      }
      log.push(`-> ${pick.dataset.scene} (${pick.querySelector('strong').textContent})`);
      pick.click(); continue;
    }
    const say = document.getElementById('say-input');
    if (say) {
      const exits = flow.scenes[st.scene].exits.filter((e) => e.from === st.beat && e.via === 'voice');
      const ok = exits.find((e) => (e.requires ?? []).every((r) => st.finished.includes(r)));
      if (ok) { log.push(`${st.scene}: say "${ok.say}"`); say.value = ok.match.join(' '); say.form.requestSubmit(); }
      else { log.push(`${st.scene}: don't remember`); [...say.form.querySelectorAll('button')].find((b) => b.textContent === 'Go back').click(); await sleep(15);
        const dr = [...document.querySelectorAll('.choices .btn')].find((b) => /remember/i.test(b.textContent)); if (dr) dr.click(); }
      continue;
    }
    const clueIn = document.getElementById('clue-answer');
    if (clueIn && !clueIn.disabled) {
      const c = petronius.clues.clues[`${st.scene}#${st.beat}`];
      log.push(`${st.scene}: clue "${c.title}" -> ${c.answers[0]}`);
      clueIn.value = c.answers[0]; clueIn.form.requestSubmit(); continue;
    }
    const clueGo = document.querySelector('.clue .btn-primary:not([type=submit])');
    if (clueGo) { clueGo.click(); continue; }
    const inputs = [...document.querySelectorAll('.puzzle input[id^=pz-]')];
    if (inputs.length) {
      const scene = await (await fetch(`../data/story/scenes/${st.scene}.json`)).json();
      const ans = scene.beats[st.beat].answers ?? [];
      inputs.forEach((inp, j) => { inp.value = ans[j] ?? ''; });
      log.push(`${st.scene}: password ${ans.join(', ')}`);
      inputs[0].form.requestSubmit(); continue;
    }
    const hot = document.querySelector('.spot:not(.found)');
    if (hot) { hot.click(); continue; }
    const ready = [...document.querySelectorAll('.puzzle .btn')].find((b) => /ready/i.test(b.textContent));
    if (ready) { ready.click(); continue; }
    const choice = document.querySelector('.choices .btn');
    if (choice) { choice.click(); continue; }
    const tap = document.querySelector('.say[role=button], .card, .lost + .btn, .full > .btn');
    if (tap) { tap.click(); continue; }
    log.push(`STUCK ${st.scene}#${st.beat}: ${document.getElementById('stage').innerText.slice(0, 150)}`); break;
  }
  return log.join('\n');
})();
