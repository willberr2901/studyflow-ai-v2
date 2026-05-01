// CONFIGURACIÓN
const CONFIG = {
     API_KEY: window.APP_ENV?.GROQ_API_KEY || '',
    PREFERRED_MODEL: 'llama-3.3-70b-versatile',
    FALLBACK_MODEL: 'llama-3.1-8b-instant',
    ENDPOINT: 'https://api.groq.com/openai/v1/chat/completions',
    MODELS_ENDPOINT: 'https://api.groq.com/openai/v1/models',
    availableModels: [],
    currentMode: 'standard'
};

// PROMPTS POR MODO
const PROMPTS = {
    standard: `Eres StudyFlow AI, un tutor experto. Responde con:
📘 EXPLICACIÓN CLARA: (Máx 3 párrafos, lenguaje sencillo)
❓ QUIZ RÁPIDO: (3 preguntas con respuestas)
📇 TARJETAS: (3 conceptos clave)`,

    quiz: `Eres un profesor experto en crear evaluaciones. Genera:
📝 EXAMEN COMPLETO sobre el tema
- 5 preguntas de opción múltiple (A, B, C, D)
- 3 preguntas de desarrollo corto
- Respuestas correctas al final
- Explicación de cada respuesta`,

    flashcards: `Crea tarjetas de estudio efectivas:
📇 TARJETA 1: 
TÉRMINO: [Concepto clave]
DEFINICIÓN: [Explicación clara]
EJEMPLO: [Ejemplo práctico]

(Repite para 5-7 conceptos importantes del tema)`,

    summary: `Resume el tema de forma estructurada:
📝 RESUMEN EJECUTIVO (2 párrafos)
 PUNTOS CLAVE (5 bullets)
📊 CONCEPTOS FUNDAMENTALES (3-4 conceptos)
💡 APLICACIÓN PRÁCTICA (cómo usarlo)`
};

// ELEMENTOS DEL DOM
const elements = {
    input: document.getElementById('topicInput'),
    btn: document.getElementById('askBtn'),
    btnText: document.querySelector('.btn-text'),
    loader: document.querySelector('.loader'),
    responseArea: document.getElementById('responseArea'),
    output: document.getElementById('aiOutput'),
    copyBtn: document.getElementById('copyBtn'),
    saveBtn: document.getElementById('saveBtn'),
    modelSelect: document.getElementById('modelSelect'),
    modelBadge: document.getElementById('modelBadge'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    modeBtns: document.querySelectorAll('.mode-btn')
};

let isLoading = false;
let currentModel = CONFIG.PREFERRED_MODEL;

// INICIALIZACIÓN
async function init() {
    await fetchAvailableModels();
    loadHistory();
    setupEventListeners();
    console.log('🚀 StudyFlow AI v2.0 cargado');
}

// 1️⃣ CONSULTAR MODELOS
async function fetchAvailableModels() {
    try {
        const response = await fetch(CONFIG.MODELS_ENDPOINT, {
            headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        CONFIG.availableModels = data.data.map(m => m.id);
        
        // Llenar el select
        elements.modelSelect.innerHTML = '';
        CONFIG.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            if (model === currentModel) option.selected = true;
            elements.modelSelect.appendChild(option);
        });

        updateModelBadge();
        console.log('📦 Modelos disponibles:', CONFIG.availableModels);
        
    } catch (error) {
        console.error('❌ Error consultando modelos:', error);
        elements.modelBadge.textContent = '⚠️ Error: ' + error.message;
        elements.modelBadge.style.background = 'rgba(248, 113, 113, 0.2)';
        elements.modelBadge.style.color = '#f87171';
        
        // Llenar con modelos por defecto
        elements.modelSelect.innerHTML = `
            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
            <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
        `;
    }
}

function updateModelBadge() {
    elements.modelBadge.textContent = `🤖 ${currentModel}`;
}

// 2️⃣ CAMBIAR MODO DE ESTUDIO
function setMode(mode) {
    CONFIG.currentMode = mode;
    elements.modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Actualizar placeholder según modo
    const placeholders = {
        standard: "Pega aquí tu tema o pregunta...",
        quiz: "Tema para generar quiz (ej: 'La Revolución Francesa')...",
        flashcards: "Tema para crear flashcards (ej: 'Verbos irregulares en inglés')...",
        summary: "Texto o tema para resumir..."
    };
    elements.input.placeholder = placeholders[mode];
}

// 3️⃣ GENERAR RESPUESTA
async function askAI() {
    const userText = elements.input.value.trim();
    if (!userText || isLoading) return;

    setLoading(true);
    elements.responseArea.classList.remove('hidden');
    elements.output.textContent = '⏳ Procesando con IA...';

    try {
        const aiReply = await callGroqAPI(userText, currentModel);
        elements.output.textContent = aiReply;
        saveToHistory(userText, aiReply, CONFIG.currentMode);
        
        // Scroll al resultado
        elements.responseArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Error:', error);
        elements.output.textContent = `❌ Error: ${error.message}`;
    } finally {
        setLoading(false);
    }
}

async function callGroqAPI(userText, model) {
    const systemPrompt = PROMPTS[CONFIG.currentMode] || PROMPTS.standard;
    
    const response = await fetch(CONFIG.ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText }
            ],
            temperature: 0.7,
            max_tokens: 1024
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Error ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// 4️⃣ HISTORIAL
function saveToHistory(question, answer, mode) {
    const history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    const item = {
        id: Date.now(),
        date: new Date().toISOString(),
        question: question.substring(0, 100),
        answer,
        mode
    };
    history.unshift(item);
    localStorage.setItem('studyHistory', JSON.stringify(history.slice(0, 50)));
    loadHistory();
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    
    if (history.length === 0) {
        elements.historyList.innerHTML = '<p class="empty-state">No hay estudios guardados aún</p>';
        return;
    }

    elements.historyList.innerHTML = history.map(item => `
        <div class="history-item" data-id="${item.id}">
            <div class="history-item-header">
                <span class="history-item-mode">${getModeEmoji(item.mode)} ${item.mode}</span>
                <button class="btn-small btn-delete" onclick="deleteHistoryItem(${item.id})">🗑️</button>
            </div>
            <div class="history-item-preview">${item.question}</div>
            <div class="history-item-date">${formatDate(item.date)}</div>
        </div>
    `).join('');
}

function deleteHistoryItem(id) {
    let history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
    history = history.filter(item => item.id !== id);
    localStorage.setItem('studyHistory', JSON.stringify(history));
    loadHistory();
}

function clearHistory() {
    if (confirm('¿Estás seguro de borrar todo el historial?')) {
        localStorage.removeItem('studyHistory');
        loadHistory();
    }
}

// UTILIDADES
function getModeEmoji(mode) {
    const emojis = { standard: '📚', quiz: '❓', flashcards: '📇', summary: '📝' };
    return emojis[mode] || '📚';
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('es-CO', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setLoading(state) {
    isLoading = state;
    elements.btn.disabled = state;
    elements.btnText.textContent = state ? 'Generando...' : 'Generar Estudio';
    elements.loader.classList.toggle('hidden', !state);
}

// EVENT LISTENERS
function setupEventListeners() {
    elements.btn.addEventListener('click', askAI);
    
    elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            askAI();
        }
    });

    elements.copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(elements.output.textContent)
            .then(() => {
                const original = elements.copyBtn.textContent;
                elements.copyBtn.textContent = '✅ Copiado';
                setTimeout(() => elements.copyBtn.textContent = original, 2000);
            })
            .catch(() => alert('❌ No se pudo copiar'));
    });

    elements.saveBtn.addEventListener('click', () => {
        const question = elements.input.value.trim();
        const answer = elements.output.textContent;
        if (question && answer) {
            saveToHistory(question, answer, CONFIG.currentMode);
            alert('✅ Guardado en historial');
        }
    });

    elements.clearHistoryBtn.addEventListener('click', clearHistory);

    elements.modelSelect.addEventListener('change', (e) => {
        currentModel = e.target.value;
        updateModelBadge();
        console.log('🔄 Modelo cambiado a:', currentModel);
    });

    elements.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Click en items del historial para cargar
    elements.historyList.addEventListener('click', (e) => {
        const item = e.target.closest('.history-item');
        if (item && !e.target.classList.contains('btn-delete')) {
            const history = JSON.parse(localStorage.getItem('studyHistory') || '[]');
            const found = history.find(h => h.id === parseInt(item.dataset.id));
            if (found) {
                elements.input.value = found.question;
                elements.output.textContent = found.answer;
                elements.responseArea.classList.remove('hidden');
                setMode(found.mode);
                elements.responseArea.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
}

// HACER GLOBAL LA FUNCIÓN DE BORRAR
window.deleteHistoryItem = deleteHistoryItem;

// INICIAR APP
init();
// ===== PWA: REGISTRAR SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('✅ Service Worker registrado'))
            .catch(err => console.log('❌ Error SW:', err));
    });
}

// ===== PWA: INSTALL PROMPT =====
let deferredPrompt;
let installButton;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Crear botón de instalar si no existe
    if (!document.getElementById('installBtn')) {
        installButton = document.createElement('button');
        installButton.id = 'installBtn';
        installButton.className = 'install-pwa-btn';
        installButton.innerHTML = '📲 Instalar App';
        installButton.onclick = installApp;
        
        // Insertar después del header
        const header = document.querySelector('.main-header');
        header.appendChild(installButton);
    }
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User choice: ${outcome}`);
        deferredPrompt = null;
        installButton.remove();
    }
}

// Detectar cuando se instala
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA instalada exitosamente');
    if (installButton) installButton.remove();
});
// ===== SISTEMA DE NOVEDADES Y NOTIFICACIONES =====

const CHANGELOG = [
    {
        version: 'v1.1.0',
        date: '2026-05-01',
        changes: [
            '🔔 Sistema de notificaciones push',
            '📱 Badge de novedades interactivo',
            '✨ Mejoras en la interfaz de usuario',
            '🐛 Corrección de errores menores'
        ],
        isNew: true
    },
    {
        version: 'v1.0.0',
        date: '2026-04-30',
        changes: [
            '🚀 Lanzamiento inicial de StudyFlow AI',
            '📚 Modo Estándar, Quiz, Flashcards y Resumen',
            '💾 Historial de estudio local',
            '📱 PWA instalable'
        ],
        isNew: false
    }
];

// Inicializar notificaciones
async function initNotifications() {
    // Solicitar permiso para notificaciones
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    
    // Registrar service worker para push
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            console.log('Service Worker listo para notificaciones');
            
            // Suscribirse a push (ejemplo)
            // const subscription = await registration.pushManager.subscribe({
            //     userVisibleOnly: true,
            //     applicationServerKey: urlBase64ToUint8Array('TU_VAPID_KEY')
            // });
        } catch (error) {
            console.error('Error registrando notificaciones:', error);
        }
    }
    
    // Verificar novedades
    checkForUpdates();
    
    // Mostrar badge si hay notificaciones
    updateNotifBadge();
}

// Verificar actualizaciones
function checkForUpdates() {
    const lastVersion = localStorage.getItem('lastViewedVersion');
    const newItems = CHANGELOG.filter(item => item.isNew);
    
    if (newItems.length > 0 && lastVersion !== CHANGELOG[0].version) {
        showToast(
            '¡Novedades disponibles!',
            `Hay ${newItems.length} nueva(s) característica(s) disponible(s)`
        );
        
        // Notificación del navegador
        if (Notification.permission === 'granted') {
            new Notification('StudyFlow AI - Novedades', {
                body: `Versión ${CHANGELOG[0].version} disponible`,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'changelog'
            });
        }
    }
}

// Actualizar badge de notificaciones
function updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    const newItems = CHANGELOG.filter(item => item.isNew);
    const count = newItems.length;
    
    if (count > 0) {
        badge.classList.remove('hidden');
        badge.querySelector('.badge-count').textContent = count;
        badge.classList.add('pulse');
    }
}

// Mostrar toast
function showToast(title, message, duration = 5000) {
    const toast = document.getElementById('toast');
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => closeToast(), duration);
}

// Cerrar toast
function closeToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
}

// Abrir changelog
function openChangelog() {
    const modal = document.getElementById('changelogModal');
    const list = document.getElementById('changelogList');
    
    list.innerHTML = CHANGELOG.map(item => `
        <div class="changelog-item ${item.isNew ? 'new' : ''}">
            <div class="changelog-version">${item.version}</div>
            <div class="changelog-date">${formatDate(item.date)}</div>
            <ul class="changelog-changes">
                ${item.changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
    
    // Marcar como visto
    localStorage.setItem('lastViewedVersion', CHANGELOG[0].version);
    document.getElementById('notifBadge').classList.remove('pulse');
}

// Cerrar changelog
function closeChangelog() {
    document.getElementById('changelogModal').style.display = 'none';
}

// Event listeners para notificaciones
document.addEventListener('DOMContentLoaded', () => {
    // Badge click
    const badge = document.getElementById('notifBadge');
    if (badge) {
        badge.addEventListener('click', openChangelog);
    }
    
    // Inicializar notificaciones
    initNotifications();
});

// Función global para notificaciones push desde el servidor
function sendPushNotification(title, options) {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
        });
    }
}

// Exportar funciones globales
window.showToast = showToast;
window.openChangelog = openChangelog;
window.sendPushNotification = sendPushNotification;