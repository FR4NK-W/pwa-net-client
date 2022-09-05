// Service worker is needed for the app to be installable
// (aka to show the installing prompt for a PWA).

// Redirect to secure connection, PWA installation is only possible with https.
if (location.hostname !== "localhost") {
  location.protocol === "http:" && (location.protocol = "https:");
} else {
  console.log("PWA installation is only possible with https.");
}
if ('serviceWorker' in navigator) {
  var registrationTarget = './sw.js';
  try {
    const policy = window?.trustedTypes?.createPolicy('trustedScriptUrlPolicy', {
      createScriptURL: (src) => {
        return src;
      },
    });
    registrationTarget = policy?.createScriptURL(registrationTarget);
  } catch (policyError) {
    console.log('Service Worker registration failed: ', policyError);
  }
  navigator.serviceWorker
    .register(registrationTarget)
    .then(() => { console.log('Registered Service Worker'); });
}
