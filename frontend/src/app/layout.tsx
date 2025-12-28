
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FactoryOS',
  description: 'Factory Operating System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
          {/* Top Bar Place holder? Or just Sidebar + Main. 
              Legacy Shell had Sidebar and Main.
              We will create the Sidebar and Main.
           */}

          {/* Sidebar - Fixed */}
          <Sidebar />

          {/* Main Content Area */}
          {/* Sidebar is fixed w-85 or w-260. 
              We need to add left margin or padding equal to width?
              Or better yet, Sidebar is fixed. Push main content.
              Sidebar transition logic affects main content if not overlay. 
              Legacy Sidebar.jsx says: transition-[width] ...
              BUT it was just an aside. 
              Usually implementation: 
              <aside className="... w-20 ..."></aside>
              <main className="flex-1 ... ml-20"></main>
              
              However, the legacy implementation passed "onExpandChange" to parent?
              Actually, the legacy code:
              `if (onExpandChange) onExpandChange(isExpanded);`
              
              For simplicity in Next.js Layout (server component wrapping client), 
              we might use a Client Layout wrapper OR just CSS approach.
              
              Let's make a subtle assumption: Sidebar is overlay or we respect the 85px.
              We'll make the main content rely on a fixed margin.
          */}

          <main className="flex-1 flex flex-col h-full ml-[85px] transition-[margin-left] duration-300">
            {/* 
                 Note: If sidebar expands to 260px, it usually overlays content OR pushes it.
                 Legacy Sidebar code: `activeView` etc.
                 Let's stick to simple layout: 85px margin for collapsed mode.
                 If it expands on hover (onMouseEnter), it overlays. 
                 The legacy sidebar has `absolute/fixed` + `z-40` + `shadow`.
                 So it expands "over" the content. Margin doesn't need to change.
             */}
            <div className="p-8 h-full overflow-y-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
