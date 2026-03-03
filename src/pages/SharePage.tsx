import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProject } from "../lib/projects";
import { getRendersByProject } from "../lib/renders";
import type { Project, RoomRender } from "../types/supabase";
import { BrandWordmark } from "../components/BrandWordmark";

export function SharePage() {
  const { id } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [renders, setRenders] = useState<RoomRender[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadShareProject(projectId: string) {
      setLoading(true);
      setNotFound(false);

      try {
        const loadedProject = await getProject(projectId);
        const loadedRenders = await getRendersByProject(projectId);
        setProject(loadedProject);
        setRenders(loadedRenders);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    void loadShareProject(id);
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-warm-stone">Loading shared project&hellip;</p>
      </main>
    );
  }

  if (notFound || !project) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-16 text-center">
        <h1 className="font-serif text-3xl font-bold text-warm-black">
          Project Not Found
        </h1>
        <p className="mt-3 text-warm-stone">
          This shared link may be invalid or the project is no longer available.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-warm-black transition hover:bg-gold-dark"
        >
          Go to <BrandWordmark size="sm" className="inline-flex align-middle" />
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-warm-stone">
            Public Project Share
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-warm-black">
            {project.title || "Untitled Project"}
          </h1>
        </div>
        <span className="rounded-full border border-warm-border bg-cream px-4 py-1.5 text-sm text-warm-stone">
          Style: {project.style || "Not selected"}
        </span>
      </header>

      <section className="rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl font-semibold text-warm-black">
          2D Floor Plan
        </h2>
        {project.floor_plan_url ? (
          <div className="w-full max-w-[800px] overflow-hidden rounded-xl border border-warm-border bg-warm-white">
            <img
              src={project.floor_plan_url}
              alt="Generated 2D floor plan"
              className="h-auto w-full"
            />
          </div>
        ) : (
          <p className="text-sm text-warm-stone">
            No floor plan generated for this project yet.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-warm-border bg-warm-white p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl font-semibold text-warm-black">
          Room Renders
        </h2>
        {renders.length === 0 ? (
          <p className="text-sm text-warm-stone">
            No room renders available for this project yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {renders.map((render) => (
              <article
                key={render.id}
                className="rounded-xl border border-warm-border bg-cream p-3"
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-cream-dark">
                  {render.image_url ? (
                    <img
                      src={render.image_url}
                      alt={render.room_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-warm-stone">
                      No render yet
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="font-medium text-warm-black">
                    {render.room_name}
                  </h3>
                  <p className="mt-1 text-xs text-warm-stone">
                    {render.prompt_used || "No prompt recorded."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-10 rounded-xl border border-warm-border bg-warm-white px-4 py-3 text-center text-sm text-warm-stone">
        Created with{" "}
        <BrandWordmark size="sm" className="mx-1 inline-flex align-middle" />{" "}
        &middot;{" "}
        <Link
          to="/"
          className="font-medium text-gold underline-offset-2 hover:text-gold-dark hover:underline"
        >
          Visit <BrandWordmark size="sm" className="inline-flex align-middle" />
        </Link>
      </footer>
    </main>
  );
}
