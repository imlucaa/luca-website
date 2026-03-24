import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
	variable: "--font-space-grotesk",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ossed.lol",
	description: "Personal homepage for Luca.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			className={`${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
			lang="en"
		>
			<body className="flex min-h-full flex-col">{children}</body>
		</html>
	);
}
