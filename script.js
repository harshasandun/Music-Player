// ------- Utility -------
    const $, $$ = (s,o=document)=> o.querySelector(s), (s,o=document)=> o.querySelectorAll(s);
    const fmt = s => isFinite(s)? new Date(s*1000).toISOString().substr(14,5) : '0:00';

    // ------- State -------
    const state = {
      index: -1,
      list: [
        // Optional web demos (will play if online). You can delete or add local files.
        {name:"Future Funk", artist:"Demo", url:"https://cdn.pixabay.com/download/audio/2022/03/15/audio_b7b3b2c9db.mp3?filename=future-funk-112194.mp3"},
        {name:"Chillhop", artist:"Demo", url:"https://cdn.pixabay.com/download/audio/2021/09/30/audio_1fe39dc6f7.mp3?filename=lofi-study-112191.mp3"}
      ],
      audio: $('#audio'),
      shuffle:false,
      repeat:false,
      dragging:false,
      ctx:null, analyser:null, data:null, viz:$('#viz'),
    };

    // ------- Web Audio Visualizer -------
    function initAudioGraph(){
      try{
        if(!state.ctx){
          const ctx = new (window.AudioContext||window.webkitAudioContext)();
          const src = ctx.createMediaElementSource(state.audio);
          const gain = ctx.createGain();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512; // 256 bars
          const data = new Uint8Array(analyser.frequencyBinCount);
          src.connect(gain).connect(analyser).connect(ctx.destination);
          state.ctx = ctx; state.analyser = analyser; state.data = data;
        }
      }catch(e){console.warn('WebAudio init failed', e)}
    }

    function drawViz(){
      const canvas = state.viz; const dpr = Math.max(devicePixelRatio||1, 1);
      const rect = canvas.getBoundingClientRect();
      if(canvas.width !== rect.width*dpr){canvas.width = rect.width*dpr; canvas.height = rect.height*dpr}
      const g = canvas.getContext('2d'); g.clearRect(0,0,canvas.width, canvas.height);
      if(!state.analyser){return}
      state.analyser.getByteFrequencyData(state.data);
      const bars = 80; const step = Math.floor(state.data.length / bars);
      const W = canvas.width, H = canvas.height; const bw = W/bars;
      for(let i=0;i<bars;i++){
        const v = state.data[i*step] / 255; // 0..1
        const h = (0.12 + v*0.78) * H; // min height
        const x = i*bw; const y = H - h;
        const grd = g.createLinearGradient(0,y,0,H);
        grd.addColorStop(0, 'rgba(124,156,255,0.9)');
        grd.addColorStop(0.6, 'rgba(0,255,208,0.8)');
        grd.addColorStop(1, 'rgba(255,255,255,0.2)');
        g.fillStyle = grd;
        const r = 6 * (devicePixelRatio||1);
        // rounded rect bar
        const rx = x + bw*0.25; const rw = bw*0.5;
        const rh = h; const ry = y;
        g.beginPath();
        const rr = Math.min(r, rw/2, rh/2);
        g.moveTo(rx+rr, ry);
        g.arcTo(rx+rw, ry, rx+rw, ry+rh, rr);
        g.arcTo(rx+rw, ry+rh, rx, ry+rh, rr);
        g.arcTo(rx, ry+rh, rx, ry, rr);
        g.arcTo(rx, ry, rx+rw, ry, rr);
        g.closePath();
        g.fill();
      }
      requestAnimationFrame(drawViz);
    }

    // ------- Playback -------
    function load(index){
      if(index<0 || index>=state.list.length) return;
      state.index = index;
      const t = state.list[index];
      state.audio.src = t.url;
      $('#trackName').textContent = t.name||'Unknown';
      $('#trackArtist').textContent = t.artist||'—';
      // thumb bg
      $('#thumb').style.background = `linear-gradient(145deg, #294094, #0d1426), url('')`;
      // spin animation resume
      $('#vinyl').style.animationPlayState = 'running';
      highlightPlaylist();
      state.audio.play().catch(()=>{});
      $('#btnPlay').textContent = '⏸️';
      updateBadges();
    }

    function next(){
      if(state.shuffle){
        const n = Math.floor(Math.random()*state.list.length);
        load(n);
      }else{
        let n = state.index + 1; if(n>=state.list.length) n = 0; load(n);
      }
    }
    function prev(){
      let n = state.index - 1; if(n<0) n = state.list.length-1; load(n);
    }

    // ------- UI Wiring -------
    function renderPlaylist(){
      const el = $('#playlist'); el.innerHTML = '';
      state.list.forEach((t, i)=>{
        const row = document.createElement('div'); row.className = 'track'; row.dataset.i = i;
        row.innerHTML = `
          <div class="dot"></div>
          <div class="meta" style="min-width:0">
            <div class="name">${t.name||'Untitled'}</div>
            <div class="artist">${t.artist||''}</div>
          </div>
          <div style="margin-left:auto; display:flex; gap:8px">
            <span class="badge">${(t.fileSizeKB||'') && (t.fileSizeKB+' KB')}</span>
            <button class="btn" data-action="delete" title="Remove">🗑️</button>
          </div>`;
        row.addEventListener('click', e=>{
          if(e.target.closest('button')) return; // ignore delete button
          load(i);
        });
        row.querySelector('button[data-action="delete"]').addEventListener('click', e=>{
          e.stopPropagation();
          state.list.splice(i,1); renderPlaylist(); highlightPlaylist();
        });
        el.appendChild(row);
      });
    }
    function highlightPlaylist(){
      $$('#playlist .track').forEach(n=>n.classList.toggle('active', Number(n.dataset.i)===state.index));
    }

    function updateBadges(){
      $('#badgeState').textContent = state.audio.paused? 'PAUSED' : 'PLAYING';
      $('#badgeMode').textContent = state.shuffle? 'SHUFFLE' : (state.repeat? 'REPEAT' : 'SEQUENTIAL');
    }

    // Seek & time
    state.audio.addEventListener('timeupdate', ()=>{
      const cur = state.audio.currentTime || 0;
      const dur = state.audio.duration || 0;
      $('#current').textContent = fmt(cur);
      $('#duration').textContent = isFinite(dur)? fmt(dur) : '0:00';
      $('#seek').value = dur? Math.floor(cur/dur*1000) : 0;
    });
    $('#seek').addEventListener('input', e=>{
      const dur = state.audio.duration||0; if(!dur) return;
      const p = Number(e.target.value)/1000; state.audio.currentTime = dur*p;
    });

    // Buttons
    $('#btnPlay').addEventListener('click', ()=>{
      if(state.audio.paused){state.audio.play(); $('#btnPlay').textContent='⏸️'} else {state.audio.pause(); $('#btnPlay').textContent='▶️'}
      updateBadges();
    });
    $('#btnPrev').addEventListener('click', prev);
    $('#btnNext').addEventListener('click', next);
    $('#btnRew').addEventListener('click', ()=> state.audio.currentTime = Math.max(0, (state.audio.currentTime||0) - 10));
    $('#btnFwd').addEventListener('click', ()=> state.audio.currentTime = Math.min((state.audio.duration||0), (state.audio.currentTime||0) + 10));
    $('#btnShuffle').addEventListener('click', ()=>{state.shuffle=!state.shuffle; if(state.shuffle) state.repeat=false; updateBadges()});
    $('#btnRepeat').addEventListener('click', ()=>{state.repeat=!state.repeat; if(state.repeat) state.shuffle=false; updateBadges()});

    // Volume
    const volume = $('#volume');
    volume.addEventListener('input', ()=>{ state.audio.volume = Number(volume.value); $('#volIcon').style.opacity = (state.audio.volume===0? .5: .9)});
    state.audio.volume = Number(volume.value);

    // Ended
    state.audio.addEventListener('ended', ()=>{ state.repeat ? load(state.index) : next() });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e)=>{
      if(['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if(e.code==='Space'){ e.preventDefault(); $('#btnPlay').click(); }
      if(e.code==='ArrowRight'){ e.preventDefault(); $('#btnFwd').click(); }
      if(e.code==='ArrowLeft'){ e.preventDefault(); $('#btnRew').click(); }
    });

    // Drag & drop + file input
    const drop = $('#drop'); const file = $('#file');
    function addFiles(files){
      [...files].forEach(f=>{
        if(!f.type.startsWith('audio/')) return;
        const url = URL.createObjectURL(f);
        state.list.push({name:f.name.replace(/\.[^.]+$/,''), artist:'Local File', url, fileSizeKB: Math.round(f.size/1024)});
      });
      renderPlaylist();
      if(state.index===-1 && state.list.length) load(0);
    }
    ;['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); state.dragging=true; drop.classList.add('drag')}));
    ;['dragleave','drop'].forEach(ev=>drop.addEventListener(ev, e=>{e.preventDefault(); state.dragging=false; drop.classList.remove('drag')}));
    drop.addEventListener('drop', e=> addFiles(e.dataTransfer.files));
    file.addEventListener('change', e=> addFiles(e.target.files));

    // Init
    renderPlaylist();
    initAudioGraph(); drawViz();

    // Autoplay first track if CORS/network allows
    if(state.list.length){ load(0);}