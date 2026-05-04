# Guía de Despliegue en Netlify - AgroGestión

## Paso 1: Preparar el Repositorio

El repositorio ya está configurado correctamente:
- ✅ `netlify.toml` con configuración de build
- ✅ `package.json` con todas las dependencias
- ✅ `.npmrc` con configuración de npm

No necesita cambios adicionales.

## Paso 2: Crear un Proyecto en Netlify

1. Ve a [https://app.netlify.com](https://app.netlify.com)
2. Inicia sesión con tu cuenta (o crea una)
3. Haz clic en **"Add new site"** → **"Import an existing project"**
4. Selecciona **GitHub** como proveedor
5. Autoriza a Netlify para acceder a tu repositorio de GitHub
6. Busca y selecciona **`matirossetto5/AgroGesti-n`**

## Paso 3: Configurar Rama y Build

En la pantalla de configuración del sitio:

- **Branch to deploy**: `main`
- **Build command**: (dejarlo vacío - Netlify lo toma de `netlify.toml`)
- **Publish directory**: (dejarlo vacío - Netlify lo toma de `netlify.toml`)

Haz clic en **"Deploy site"**

## Paso 4: Configurar Variables de Entorno

Después de crear el sitio, ve a **Site settings** → **Build & deploy** → **Environment**

Haz clic en **"Edit variables"** y agrega estas 6 variables de Firebase:

```
VITE_FIREBASE_API_KEY = AIzaSyDeXe0rlbpEh4jxTUW3DCbtg4Kt1wvTNpk
VITE_FIREBASE_AUTH_DOMAIN = agrogestion-90d6a.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = agrogestion-90d6a
VITE_FIREBASE_STORAGE_BUCKET = agrogestion-90d6a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 369522793238
VITE_FIREBASE_APP_ID = 1:369522793238:web:ade80d14566053af624e37
```

**Importante**: Después de agregar las variables, ve a **Deploys** → **Trigger deploy** → **Deploy site** para que Netlify rebuildee con las nuevas variables.

## Paso 5: Configurar Firebase (Una sola vez)

En [Firebase Console](https://console.firebase.google.com):

### 5.1 Authentication

1. Proyecto: `agrogestion-90d6a`
2. Ve a **Authentication** → **Sign-in method**
3. Habilita:
   - ✅ Email/Password
   - ✅ Google

### 5.2 Authorized Domains

1. Ve a **Authentication** → **Settings** → **Authorized domains**
2. Agrega tu dominio de Netlify (ejemplo: `agrogestion.netlify.app`)
   - Lo encontrarás en el dashboard de Netlify bajo **Site overview** → **Site name**

### 5.3 Firestore Database

1. Ve a **Firestore Database**
2. Si no existe, crea una:
   - Haz clic en **"Create database"**
   - Selecciona **"Start in production mode"**
   - Elige la región más cercana (ejemplo: `us-central1`)

3. Configura las reglas de seguridad (ir a **Rules** tab):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios pueden leer/escribir solo sus propios documentos
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Cada campo puede solo ser leído/escrito por su propietario
    match /farms/{farmId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      match /{document=**} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/farms/$(farmId)).data.userId;
      }
    }
  }
}
```

4. Publica las reglas haciendo clic en **"Publish"**

## Paso 6: Verificar el Despliegue

1. En Netlify, ve a **Deploys** y espera a que el build termine
   - El build tarda ~3-5 minutos
   - Verde = Éxito, Rojo = Error

2. Si el build es verde, haz clic en el URL del sitio (ej: `https://agrogestion.netlify.app`)

3. Prueba la aplicación:
   - ✅ Inicia sesión con email/password
   - ✅ Inicia sesión con Google
   - ✅ Crea un campo/cultivo
   - ✅ Verifica que los mapas cargan
   - ✅ Verifica que el clima se muestra

## Solución de Problemas

### Error: "Build failed"

1. Ve a **Deploys** → última build → **Deploy log**
2. Busca líneas rojas con errores
3. Causas comunes:
   - Variables de Firebase faltantes o incorrectas
   - Node version incompatible (debe ser 20+)

### Error: "Firebase initialization failed"

1. Verifica que TODAS las variables de Firebase estén en Netlify
2. Copia exactamente desde `firebase-applet-config.json` (están en el repo)
3. Espera 5 minutos después de cambiar variables
4. Reconstruye el sitio (**Deploys** → **Trigger deploy**)

### Error: "Mapas no cargan"

1. Los mapas usan OpenStreetMap/Leaflet (gratis, sin API key)
2. Verifica tu conexión a internet
3. Abre la consola del navegador (F12) y busca errores
4. Los mapas deberían cargar automáticamente

### Error: "El clima no muestra"

1. El clima usa Open-Meteo API (completamente gratis)
2. Si no muestra, abre la consola (F12) y busca errores de red
3. Los datos se actualizan cada 30 minutos

## Actualizar la Aplicación

Para hacer cambios en el código:

1. Haz los cambios localmente
2. Verifica que compila: `npm run build`
3. Haz commit: `git add . && git commit -m "tu mensaje"`
4. Haz push: `git push origin main`
5. Netlify automáticamente rebuildea y deploya

## Monitoreo

- **Netlify Dashboard**: Ve a tu sitio → **Analytics** para ver uptime y performance
- **Firebase Console**: Ve a **Firestore** para ver uso de base de datos
- **Logs del navegador**: Abre F12 en la app en vivo para ver errores en tiempo real
