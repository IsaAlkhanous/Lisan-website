document.addEventListener('DOMContentLoaded', () => {
const body = document.getElementById('body');
const chat = document.getElementById('chat');
const input = document.getElementById('message');
const send = document.getElementById('send');
const menuBtn = document.getElementById('menu-btn');
const leftSidebar = document.getElementById('left-sidebar');
const chatToggle = document.getElementById('chat-toggle');
const rightSidebar = document.getElementById('right-sidebar');
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const closeSettings = document.getElementById('close-settings');
const title = document.querySelector('h1');
const dialectPanel = document.getElementById('dialect-panel');

// Info / About section button and panel
const infoBtn = document.getElementById('info-btn');
const infoSection = document.getElementById('info-section');

if (infoBtn && infoSection) {
  infoBtn.addEventListener('click', () => {
    const isHidden = infoSection.classList.contains('hidden');

    if (isHidden) {
      infoSection.classList.remove('hidden');
      infoSection.classList.add('visible');
    } else {
      infoSection.classList.remove('visible');
      infoSection.classList.add('hidden');
    }

    infoBtn.classList.toggle('active');
  });
}


// 🔊 Global Text-to-Speech setup
const hasTTS = 'speechSynthesis' in window;
const synth = window.speechSynthesis;
let ttsVoices = [];
// Load available voices
function loadVoices() {
  if (!hasTTS) return;
  ttsVoices = synth.getVoices();
  console.log(
    'Available TTS voices:',
    ttsVoices.map(v => `${v.name} (${v.lang})`)
  );
}

if (hasTTS) {
  loadVoices();
  // voices list can load asynchronously
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', loadVoices);
  } else if ('onvoiceschanged' in synth) {
    synth.onvoiceschanged = loadVoices;
  }
}

// Helper: speak some text
function speakText(msg) {
  if (!hasTTS) {
    console.warn('Text-to-speech not supported in this browser');
    return;
  }

  const text = (msg || '').trim();
  if (!text) return;

  // Stop any ongoing speech
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);

  // Detect if text is mostly Arabic
  const isArabic = /[\u0600-\u06FF]/.test(text);

  // Try to pick an Arabic voice if we have one
  let voice = null;
  if (isArabic && ttsVoices.length) {
    voice = ttsVoices.find(v =>
      v.lang.toLowerCase().startsWith('ar')
    );
  }

  // Fallback: pick an English voice or the first available
  if (!voice && ttsVoices.length) {
    voice =
      ttsVoices.find(v =>
        v.lang.toLowerCase().startsWith('en')
      ) || ttsVoices[0];
  }

  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    // last-resort fallback
    utter.lang = isArabic ? 'ar' : 'en-US';
  }

  console.log(
    'Speaking with voice:',
    voice ? `${voice.name} (${voice.lang})` : utter.lang
  );
  synth.speak(utter);
}

// ✅ API URL
const WEBHOOK_URL =
  'https://progquack.app.n8n.cloud/webhook/a4d553d5-73ce-409b-8f6e-703bfc6c83d2';
const INIT_URL = 'https://progquack.app.n8n.cloud/webhook/get-region-counts';
let isSending = false;


// Dialect counters state
const dialectCounts = {
  MSA: 0, NA: 0, NILE: 0, LEV: 0, IRAQ: 0, YEM: 0, GULF: 0
};

const DIALECTS = ['MSA', 'NA', 'NILE', 'LEV', 'IRAQ', 'YEM', 'GULF'];
window.addEventListener('load', () => {
  ChangeBG('MSA');
  loadInitialStats();
});
async function loadInitialStats() {
  try {
    const res = await fetch(INIT_URL);
    if (!res.ok) {
      console.error('Init stats failed:', res.status);
      return;
    }

    const data = await res.json();
    console.log('Init counts:', data);

    if (data.counts) {
      // Merge into local state
      for (const key in data.counts) {
        if (dialectCounts.hasOwnProperty(key)) {
          dialectCounts[key] = data.counts[key];

          // Update UI counter
          const counter = document.querySelector(
            `[data-dialect="${key}"] .dialect-count`
          );
          if (counter) counter.textContent = dialectCounts[key];
        }
      }
    }
  } catch (err) {
    console.error('Error loading initial stats:', err);
  }
}

// ✅ Change background based on dialect code
function ChangeBG(dialect) {
  if (!DIALECTS.includes(dialect)) {
    console.warn('ChangeBG: invalid dialect:', dialect);
    return;
  }

  const url = `./images/map/${dialect}.png`;
  console.log('ChangeBG: setting background to', url);
  body.style.backgroundImage = `url("${url}")`;
}

function updateDialectCount(dialect) {
  if (dialectCounts.hasOwnProperty(dialect)) {
    dialectCounts[dialect]++;
    const counter = document.querySelector(`[data-dialect="${dialect}"]`);
    if (counter) {
      const countDisplay = counter.querySelector('.dialect-count');
      countDisplay.textContent = dialectCounts[dialect];

      counter.classList.add('active');
      setTimeout(() => counter.classList.remove('active'), 500);
    }
  }
}

// (Optional) keyboard shortcuts 1–7 → dialects
body.addEventListener('keydown', (e) => {
  const idx = parseInt(e.key, 10) - 1;
  if (idx >= 0 && idx < DIALECTS.length) {
    ChangeBG(DIALECTS[idx]);
  }
});

menuBtn.addEventListener('click', () => {
  leftSidebar.classList.toggle('open');
});

chatToggle.addEventListener('click', () => {
  rightSidebar.classList.toggle('open');
  dialectPanel.classList.toggle('shift-left');

  title.style.opacity = rightSidebar.classList.contains('open') ? '0.3' : '1';
});

settingsBtn.addEventListener('click', () => {
  settingsOverlay.classList.add('open');
});

closeSettings.addEventListener('click', () => {
  settingsOverlay.classList.remove('open');
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

// Chat functionality
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') send.click();
});

send.addEventListener('click', async () => {
  if (isSending) return;

  const text = input.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  input.value = '';

  appendMessage('...', 'assistant loading');

  isSending = true;
  send.disabled = true;

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Webhook failed ${res.status}: ${errTxt}`);
    }

    const data = await res.json().catch(() => ({}));

    const reply =
      data.final_response ??
      data.reply ??
      data.choices?.[0]?.message?.content ??
      'ما في رد من السيرفر';

    replaceLastMessage(reply);

    if (data.winning_label) {
      updateDialectCount(data.winning_label);
      ChangeBG(data.winning_label);
    }

  } catch (err) {
    console.error(err);
    replaceLastMessage('هناك خطب ما في التواصل');
  } finally {
    isSending = false;
    send.disabled = false;
    input.focus();
  }
});

function appendMessage(text, role) {
  const div = document.createElement('div');
  // role can be "assistant loading", so just check startsWith
  const baseRole = role.startsWith('assistant') ? 'assistant' : role;
  div.className = 'message ' + baseRole;

  // Text container
  const textDiv = document.createElement('div');
  textDiv.className = 'message-text';
  textDiv.textContent = text;
  div.appendChild(textDiv);

  // Only assistant messages get buttons
  if (baseRole === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'نسخ الرد';

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'tts-btn';
    ttsBtn.textContent = '🔊';
    ttsBtn.title = 'قراءة الرد بصوت عالٍ';

    // Copy handler
    copyBtn.addEventListener('click', () => {
      const textToCopy = textDiv.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(err => {
          console.error('Copy failed:', err);
        });
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });


    // TTS handler
      ttsBtn.addEventListener('click', () => {
        const msg = textDiv.textContent;
        speakText(msg);
      });


    actions.appendChild(copyBtn);
    actions.appendChild(ttsBtn);
    div.appendChild(actions);
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}


function replaceLastMessage(text) {
  const messages = chat.querySelectorAll('.message.assistant');
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];

  // Find existing text div or create structure if needed
  let textDiv = lastMsg.querySelector('.message-text');

  if (!textDiv) {
    // This happens for the initial "loading" bubble: rebuild it
    lastMsg.innerHTML = '';
    lastMsg.className = 'message assistant';

    textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    lastMsg.appendChild(textDiv);

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = 'نسخ الرد';

    const ttsBtn = document.createElement('button');
    ttsBtn.className = 'tts-btn';
    ttsBtn.textContent = '🔊';
    ttsBtn.title = 'قراءة الرد بصوت عالٍ';

    // same handlers as above
    copyBtn.addEventListener('click', () => {
      const textToCopy = textDiv.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(err => {
          console.error('Copy failed:', err);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    });

    ttsBtn.addEventListener('click', () => {
      const msg = textDiv.textContent;
      speakText(msg);
    });


    actions.appendChild(copyBtn);
    actions.appendChild(ttsBtn);
    lastMsg.appendChild(actions);
  }

  textDiv.textContent = text;
}


// Microphone Section

const attachBtn = document.getElementById('attach');

let recognition = null;
let isRecording = false;
let finalTranscript = '';

(function setupSpeech() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('SpeechRecognition not supported');
    attachBtn.disabled = true;
    attachBtn.title = 'المتصفح لا يدعم تحويل الصوت إلى نص';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'ar';          // pick dialect: ar-SA / ar-EG / ar-LB ...
  recognition.interimResults = true;   // show partial text while speaking
  recognition.continuous = false;      // stop after one phrase

  recognition.addEventListener('start', () => {
    isRecording = true;
    finalTranscript = '';
    attachBtn.classList.add('recording');
    attachBtn.title = 'يتم التسجيل... اضغط للإيقاف';
    console.log('Speech: start');
  });

  recognition.addEventListener('end', () => {
    isRecording = false;
    attachBtn.classList.remove('recording');
    attachBtn.title = 'تسجيل صوت';
    console.log('Speech: end');

    // if we got final text, send it like a normal message
    const text = finalTranscript.trim();
    if (text) {
      input.value = text;   // show in input
      // send.click();         // trigger your existing send logic
    }
  });

  recognition.addEventListener('error', (e) => {
    console.error('Speech error:', e);
    isRecording = false;
    attachBtn.classList.remove('recording');
    attachBtn.title = 'تسجيل صوت';
  });

  recognition.addEventListener('result', (event) => {
    let interim = '';
    finalTranscript = '';

    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        finalTranscript += res[0].transcript;
      } else {
        interim += res[0].transcript;
      }
    }

    const current = (finalTranscript + ' ' + interim).trim();

    // show live transcription in the input box
    input.value = current;
  });

  attachBtn.addEventListener('click', () => {
    if (!recognition) return;

    if (isRecording) {
      // stop recording manually
      recognition.stop();
    } else {
      // start a new recording
      try {
        recognition.start();
      } catch (e) {
        // Chrome throws if start() is called while it's already starting
        console.warn('Could not start recognition:', e);
      }
    }
  });
})();

});

