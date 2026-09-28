/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // En-têtes de sécurité HTTP appliqués à toutes les routes — durcissement
  // "production readiness" : aucune CSP stricte pour l'instant (l'app
  // utilise un petit script inline anti-flash pour le mode sombre et des
  // tuiles OpenStreetMap ; une CSP mal calibrée casserait ça sans tests
  // approfondis), mais les protections sans risque de régression sont
  // activées.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
