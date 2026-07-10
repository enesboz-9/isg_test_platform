import "./globals.css";

export const metadata = {
  title: "YEDAŞ İSG Test Platformu",
  description: "İş Sağlığı ve Güvenliği değerlendirme testi",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('isg-theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
