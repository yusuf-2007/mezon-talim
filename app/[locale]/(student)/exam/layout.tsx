/**
 * Inside a course the site header gives way to each page's own focus bar: the
 * way back to the course, its name, and progress or the exam clock. Nothing
 * else competes with the lesson or the question in front of the student.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-lp-wash-alt font-lp-body text-lp-ink">{children}</div>;
}
