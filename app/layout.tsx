import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Flat & Fork — Your shared kitchen, sorted',description:'Plan weekly meals together, vote for your favourites, and share kitchen duties with your flatmates.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
