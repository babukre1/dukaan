import { router } from 'expo-router'
import { CalendarDays, ChevronRight, KeyRound, LogOut, Store, UserRound } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Screen } from '@/components/ui'
import { colors } from '@/constants/design'
import { mobileApi, type Subscription } from '@/lib/api'
import { useAuth } from '@/providers/auth'

export default function Settings() {
  const { profile, logout } = useAuth()
  const [subscription, setSubscription] = useState<Subscription>(null)
  useEffect(() => { mobileApi.subscription().then(setSubscription).catch(() => undefined) }, [])
  async function signOut() { await logout(); router.replace('/login') }

  return <Screen title="Settings"><View className="flex-row items-center gap-[11px] rounded-xl bg-brand-soft p-3.5"><CalendarDays size={22} color={colors.green}/><View className="flex-1"><Text className="mt-[3px] text-[9px] text-muted">Subscription status</Text><Text className="mt-[3px] text-xs font-bold text-brand">{subscription ? `${subscription.planName} · ${subscription.effectiveStatus}` : 'Not assigned'}</Text>{subscription && <Text className="mt-[3px] text-[9px] text-muted">Until {new Date(subscription.expiresAt).toLocaleDateString()}</Text>}</View></View><View className="mt-3"><Row icon={Store} title="Shop profile" meta={profile?.shopName}/><Row icon={UserRound} title="Owner profile" meta={`${profile?.fullName ?? ''} · ${profile?.phoneNumber ?? ''}`}/><Row icon={KeyRound} title="Change password" onPress={() => router.push('/change-password')}/><Row icon={LogOut} title="Log out" danger onPress={signOut}/></View></Screen>
}

function Row({ icon: Icon, title, meta, danger = false, onPress }: { icon: typeof Store; title: string; meta?: string; danger?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} className="min-h-[61px] flex-row items-center gap-2.5 border-b border-line"><View className="h-9 w-9 items-center justify-center rounded-[9px] bg-[#EEF7E9]"><Icon size={18} color={danger ? colors.danger : colors.green}/></View><View className="flex-1"><Text className={`text-xs font-bold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</Text>{meta && <Text className="mt-[3px] text-[9px] text-muted">{meta}</Text>}</View><ChevronRight size={16} color={colors.muted}/></Pressable>
}

