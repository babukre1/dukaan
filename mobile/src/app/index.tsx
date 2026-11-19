import { router } from 'expo-router'
import { CalendarDays, CircleAlert, LockKeyhole, Store } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Screen, SectionTitle } from '@/components/ui'
import { colors } from '@/constants/design'
import { mobileApi, type Subscription } from '@/lib/api'
import { useAuth } from '@/providers/auth'

export default function HomeScreen() {
  const { profile } = useAuth()
  const [subscription, setSubscription] = useState<Subscription>(null)
  const [error, setError] = useState('')
  useEffect(() => { mobileApi.subscription().then(setSubscription).catch(reason => setError(reason.message)) }, [])

  if (profile?.mustChangePassword) { router.replace('/change-password'); return null }
  if (profile?.accountStatus === 'SUSPENDED' || profile?.accountStatus === 'INACTIVE') {
    return <Screen bottomNav={false}><View className="min-h-[420px] flex-1 items-center justify-center p-7"><LockKeyhole size={38} color={colors.danger}/><Text className="mt-[15px] text-center text-xl font-extrabold text-ink">Shop access is {profile.accountStatus.toLowerCase()}</Text><Text className="mt-2 text-center text-xs leading-[18px] text-muted">Your account status is separate from your subscription. Contact the DukaanFlow administrator for help.</Text></View></Screen>
  }

  return <Screen><View className="flex-row items-center gap-3 rounded-[14px] bg-[#F4F7F4] p-[15px]"><View className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-brand-soft"><Store size={22} color={colors.green}/></View><View><Text className="text-[9px] font-extrabold tracking-[1px] text-brand">YOUR SHOP</Text><Text className="mt-0.5 text-lg font-extrabold text-ink">{profile?.shopName ?? 'Shop account'}</Text><Text className="mt-[3px] text-[10px] text-muted">{profile?.fullName} · {profile?.phoneNumber}</Text></View></View><SectionTitle>Subscription</SectionTitle>{error ? <Text className="rounded-lg bg-[#FBE3E5] p-2.5 text-danger">{error}</Text> : subscription ? <View className="flex-row items-center gap-[11px] rounded-xl bg-brand-soft p-[15px]"><CalendarDays size={23} color={colors.green}/><View className="flex-1"><Text className="text-[13px] font-extrabold text-brand">{subscription.planName} · {subscription.effectiveStatus}</Text><Text className="mt-1 text-[10px] text-muted">Expires {new Date(subscription.expiresAt).toLocaleDateString()} · {subscription.daysRemaining} days remaining</Text></View></View> : <View className="flex-row items-center gap-2.5 rounded-xl bg-amber-soft p-3.5"><CircleAlert size={22} color={colors.amber}/><Text className="flex-1 text-[11px] leading-4 text-ink">No subscription has been assigned. Contact the administrator.</Text></View>}{subscription?.access === 'READ_ONLY' && <View className="mt-2.5 flex-row gap-[9px] rounded-[10px] bg-[#FBE3E5] p-[13px]"><CircleAlert size={20} color={colors.danger}/><Text className="flex-1 text-[10px] leading-[15px] text-danger">Your subscription has expired. Existing records remain viewable, but changes are disabled.</Text></View>}<SectionTitle>Business modules</SectionTitle><View className="rounded-xl border border-line p-[17px]"><Text className="text-[13px] font-extrabold text-ink">Debt, inventory, and sales are coming next</Text><Text className="mt-[5px] text-[11px] leading-[17px] text-muted">These Phase 4-6 modules are intentionally unavailable. No fake totals are shown.</Text></View><Pressable className="mt-3.5 h-11 items-center justify-center rounded-[10px] border border-brand" onPress={() => router.push('/settings')}><Text className="text-xs font-bold text-brand">Open account settings</Text></Pressable></Screen>
}

