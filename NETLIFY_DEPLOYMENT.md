# Guía de Despliegue en Netlify - AgroGestión

## Requisitos Previos

- Cuenta en [Netlify](https://netlify.com)
- Cuenta en [Firebase](https://firebase.google.com)

**Nota:** AgroGestión ya no depende de APIs de Google o Gemini. Los mapas utilizan OpenStreetMap/CartoDB (gratis) y el clima usa Open-Meteo API (gratis).

## Pasos de Despliegue

### 1. Conectar Netlify con GitHub

1. Ve a [Netlify Dashboard](https://app.netlify.com)
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Selecciona **GitHub** como proveedor
4. Autoriza a Netlify acceder a tu cuenta de GitHub
5. Busca y selecciona el repositorio **"AgroGesti-n"**

### 2. Configurar rama e instancias

En la pantalla de configuración:
- **Branch to deploy**: `claude/review-app-improvements-aBTtp`
- **Build command**: `npm run build`
- **Publish directory**: `dist`

### 3. Configurar Variables de Entorno

Antes de hacer click en "Deploy", agrega las variables de entorno:

1. Ve a **"Environment"** en la configuración del sitio
2. Haz clic en **"Edit variables"**
3. Agrega estas 6 variables (obtenlas de Firebase Console):

```
VITE_FIREBASE_API_KEY = <tu_firebase_api_key>
VITE_FIREBASE_AUTH_DOMAIN = <tu_firebase_auth_domain>
VITE_FIREBASE_PROJECT_ID = <tu_firebase_project_id>
VITE_FIREBASE_STORAGE_BUCKET = <tu_firebase_storage_bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID = <tu_firebase_messaging_sender_id>
VITE_FIREBASE_APP_ID = <tu_firebase_app_id>
```

### 4. Configurar Firebase para Netlify

En Firebase Console:

1. Ve a **Authentication** > **Sign-in method**
2. Habilita:
   - Google
   - Email/Password

3. Ve a **Authentication** > **Authorized domains**
4. Agrega tu dominio de Netlify (ej: `agrogestion.netlify.app`)

### 5. Configurar Firestore

1. Ve a **Firestore Database**
2. Crea una base de datos en modo producción
3. Configura las reglas de seguridad:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /farms/{farmId} {
      allow read, write: if request.auth.uid == resource.data.userId;
      match /{document=**} {
        allow read, write: if request.auth.uid == get(/databases/$(database)/documents/farms/$(farmId)).data.userId;
      }
    }
  }
}
```

### 6. Deploy

1. Haz clic en **"Deploy site"**
2. Netlify construirá el proyecto automáticamente
3. Monitorea el build en la sección de **Deploys**

### 7. Verificar el Despliegue

Después del despliegue:

1. Visita tu URL de Netlify (ej: `https://agrogestion.netlify.app`)
2. Prueba la autenticación con Google y email
3. Crea un campo de prueba
4. Verifica que todas las funcionalidades están activas

## Funcionalidades Disponibles

✅ **Reportes**: Genera PDF y Excel con resumen financiero
✅ **Análisis Financiero**: Gráficos de flujo de caja y análisis de gastos
✅ **Clima**: Pronóstico integrado con alertas
✅ **Inventario**: Gestión de semillas, fertilizantes y medicinas
✅ **Notificaciones**: Sistema de alertas y notificaciones
✅ **Búsqueda Avanzada**: Filtros complejos en toda la aplicación
✅ **Offline**: Funciona sin conexión con sincronización posterior
✅ **Mapas**: OpenStreetMap + CartoDB (gratis, sin API key)

## Actualizaciones Futuras

Para actualizar la aplicación en producción:

1. Haz cambios locales
2. Verifica que pasen los type checks: `npm run type-check`
3. Haz commit y push a la rama `claude/review-app-improvements-aBTtp`
4. Netlify automáticamente desplegará los cambios

## Troubleshooting

### Error: "Firebase initialization failed"
- Verifica que todas las variables de Firebase estén correctamente configuradas
- Asegúrate de que el dominio de Netlify esté autorizado en Firebase
- Confirma que Firestore Database está habilitada en tu proyecto Firebase

### Error: "Build failed"
- Verifica en los logs de Netlify qué causa el error
- Asegúrate de que `npm run build` funciona localmente: `npm run build`
- Verifica que todas las dependencias estén instaladas: `npm install`

### Error: "Mapas no cargan correctamente"
- Los mapas usan OpenStreetMap/CartoDB (sin API key)
- Verifica tu conexión a internet
- Los mapas deberían cargar automáticamente sin configuración adicional

### Error: "El clima no se muestra"
- El clima usa Open-Meteo API (completamente gratis, sin API key)
- Si no muestra, verifica que tu dominio de Netlify pueda hacer requests HTTP
- Los datos de clima se actualizan cada 30 minutos

## Monitoreo

- **Netlify Analytics**: Monitorea rendimiento y uptime
- **Firebase Console**: Monitorea uso de Firestore y autenticación
- **OpenStreetMap**: Sin límites de uso
- **Open-Meteo**: Sin límites de uso

## Soporte

Para reportar problemas:
1. Revisa los logs en el dashboard de Netlify (Deploys → build logs)
2. Consulta los logs del navegador (F12)
3. Verifica Firebase Console para errores de autenticación
