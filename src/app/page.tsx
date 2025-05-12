import { HydrateClient } from "~/trpc/server";
import { PromptInterface } from "./_components/PromptInterface";

export default function Home() {
	return (
		<HydrateClient>
			<main className="min-h-screen p-8">
				<div className="mx-auto max-w-7xl">
					<PromptInterface />
				</div>
			</main>
		</HydrateClient>
	);
}
