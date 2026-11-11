import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { useSession } from '@/features/auth/queries'
import { sessionStore } from '@/shared/api/session-storage'
import type { Profile, Session } from '@/shared/contracts'
import { changePassword, deleteAvatar, fetchProfile, updateProfile, uploadAvatar } from './api'
import { resizeToDataUrl } from './avatar'

export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.user(userId).profile(),
    queryFn: ({ signal }) => fetchProfile(signal),
  })
}

/** The signed-in user's profile; idle (no request) for guests. */
export function useProfile() {
  const session = useSession()
  const userId = session?.user.id ?? ''
  return useQuery({ ...profileQueryOptions(userId), enabled: Boolean(session) })
}

/** Stores the saved profile and mirrors the fields the header reads into the session (cache + storage). */
function applyProfile(queryClient: QueryClient, profile: Profile): void {
  queryClient.setQueryData(queryKeys.user(profile.id).profile(), profile)
  const session = queryClient.getQueryData<Session | null>(queryKeys.session())
  if (!session || session.user.id !== profile.id) return
  const next: Session = {
    ...session,
    user: {
      ...session.user,
      username: profile.username,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    },
  }
  sessionStore.set(next)
  queryClient.setQueryData(queryKeys.session(), next)
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => applyProfile(queryClient, profile),
  })
}

export function useSetAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => uploadAvatar(await resizeToDataUrl(file)),
    onSuccess: (profile) => applyProfile(queryClient, profile),
  })
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: (profile) => applyProfile(queryClient, profile),
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}
