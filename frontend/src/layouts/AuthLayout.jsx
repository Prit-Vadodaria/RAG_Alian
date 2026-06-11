function AuthLayout({ eyebrow, title, description, children, footer }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(200,255,87,0.14),transparent_30%),linear-gradient(180deg,#0d0d0d_0%,#090909_100%)] px-4 py-10 text-[color:var(--on-dark)]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-page flex flex-col justify-between gap-6 p-8 lg:p-10">
            <div>
              <p className="text-kicker">{eyebrow}</p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight text-[color:var(--on-dark)] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--on-dark-soft)] sm:text-base">
                {description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-card p-4">
                <p className="text-kicker">Secure</p>
                <p className="mt-2 text-sm text-[color:var(--body)]">
                  Token-backed access control.
                </p>
              </div>
              <div className="surface-card p-4">
                <p className="text-kicker">Private</p>
                <p className="mt-2 text-sm text-[color:var(--body)]">
                  Workspace data stays scoped per client.
                </p>
              </div>
              <div className="surface-card p-4">
                <p className="text-kicker">Fast</p>
                <p className="mt-2 text-sm text-[color:var(--body)]">
                  Resume where you left off instantly.
                </p>
              </div>
            </div>
          </div>

          <div className="surface-page p-8 lg:p-10">
            {children}
            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
