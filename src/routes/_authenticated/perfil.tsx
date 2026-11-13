import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ProfileSidebar } from '@/features/profile/components/ProfileSidebar'

export const Route = createFileRoute('/_authenticated/perfil')({
  component: ProfileLayout,
})

function ProfileLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[310px_1fr] lg:gap-7">
      <ProfileSidebar />
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  )
}
