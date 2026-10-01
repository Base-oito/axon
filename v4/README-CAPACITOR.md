# App Android (Capacitor)

O SPA (Axon v4) é empacotado em app Android via Capacitor. O projeto nativo fica em `android/`.

## Ambiente local (máquina de dev — sem sudo)

- **JDK 21** (Temurin) em `~/jdk21` (o Capacitor 8 exige Java 21, não 17)
- **Android SDK** em `~/Android/sdk` (platform-tools, platforms;android-36, build-tools;36.0.0)
- Script de ambiente: `source android-env.sh`

## Build do APK

```bash
source android-env.sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# APK final: android/app/build/outputs/apk/debug/app-debug.apk
# Cópia na raiz do projeto: axon-android.apk
```

## API no app nativo

`main.tsx` intercepta `fetch` prefixando URLs `/api` com `https://contador.app.baseoito.org`
(ou `VITE_API_ORIGIN`). No web nada muda (same-origin).

## UI mobile

- `useIsMobile` retorna `true` sempre no Capacitor (mobile-first) — não depende de media query.
- Sidebar vira **drawer** (fixed, `hidden` quando fechado, abre pelo hambúrguer no header).
- Telas usam `100dvh` (não `100vh`) para evitar overflow da barra de status no Android.