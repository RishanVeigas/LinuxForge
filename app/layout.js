import './globals.css';

export const metadata = {
  title: 'LinuxMastery — Command the Shell',
  description: 'Learn Linux commands hands-on, in the terminal, with real feedback. From your first ls to production shell scripts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>{children}</body>
    </html>
  );
}
