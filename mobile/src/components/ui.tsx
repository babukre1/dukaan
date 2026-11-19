import type { ComponentType, ReactNode } from 'react'
import { router, usePathname } from 'expo-router'
import { Bell, ChevronLeft, Home, MoreHorizontal, Package, ReceiptText, Store, Users } from 'lucide-react-native'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context'
import { withUniwind } from 'uniwind'
import { colors } from '@/constants/design'
import { useAuth } from '@/providers/auth'

type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>
const SafeAreaView = withUniwind(NativeSafeAreaView)

export function Screen({ children, title, back = false, action, bottomNav = true, contentClassName = '' }: { children: ReactNode; title?: string; back?: boolean; action?: ReactNode; bottomNav?: boolean; contentClassName?: string }) {
  return <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}><View className="flex-1 bg-surface"><Header title={title} back={back} action={action}/><ScrollView className="flex-1" contentContainerClassName={`px-4 pt-3.5 pb-[94px] ${contentClassName}`} showsVerticalScrollIndicator={false}>{children}</ScrollView>{bottomNav && <BottomNav/>}</View></SafeAreaView>
}

export function Header({ title, back = false, action }: { title?: string; back?: boolean; action?: ReactNode }) {
  const { profile } = useAuth()
  return <View className="h-16 flex-row items-center gap-2 border-b border-line px-3.5">{back ? <Pressable accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} className="h-[38px] w-[38px] items-center justify-center rounded-[9px] active:bg-canvas"><ChevronLeft size={23} color={colors.text}/></Pressable> : !title ? <View className="flex-1 flex-row items-center gap-2.5"><View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-brand-soft"><Store size={19} color={colors.green}/></View><View><Text className="text-sm font-bold text-ink">{profile?.shopName ?? 'DukaanFlow'}</Text><Text className="mt-0.5 text-[10px] text-muted">{profile?.phoneNumber ?? 'Shop owner'}</Text></View></View> : null}{title && <Text className={`flex-1 text-lg font-bold text-ink ${back ? 'text-center' : ''}`}>{title}</Text>}{action ?? <Pressable accessibilityLabel="Notifications" className="h-[38px] w-[38px] items-center justify-center rounded-[9px] active:bg-canvas"><Bell size={20} color={colors.text}/></Pressable>}</View>
}

const nav = [{ label: 'Home', href: '/' as const, icon: Home }, { label: 'Customers', href: '/customers' as const, icon: Users }, { label: 'Sales', href: '/sales' as const, icon: ReceiptText }, { label: 'Stock', href: '/products' as const, icon: Package }, { label: 'More', href: '/settings' as const, icon: MoreHorizontal }]

export function BottomNav() {
  const path = usePathname()
  return <View className="h-[72px] flex-row border-t border-line bg-surface pb-[7px] pt-[7px]">{nav.map(item => { const active = item.href === '/' ? path === '/' : path.startsWith(item.href); const Icon = item.icon; return <Pressable key={item.href} onPress={() => router.replace(item.href)} className="flex-1 items-center justify-center gap-[3px]"><Icon size={20} color={active ? colors.green : '#7B847D'} strokeWidth={active ? 2.4 : 1.8}/><Text className={`text-[9px] font-semibold ${active ? 'font-bold text-brand' : 'text-[#727D74]'}`}>{item.label}</Text></Pressable> })}</View>
}

export function MetricCard({ icon: Icon, label, value, plain = false }: { icon: IconComponent; label: string; value: string; plain?: boolean }) {
  return <View className={`min-h-[94px] min-w-[45%] flex-1 justify-between rounded-xl p-[13px] ${plain ? 'bg-[#F4F6F4]' : 'bg-brand-soft'}`}><Icon size={19} color={colors.green}/><View><Text className="text-[10px] text-[#4E5A50]">{label}</Text><Text className="mt-1 text-[17px] font-extrabold text-ink">{value}</Text></View></View>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <View className="mb-2.5 mt-[22px] flex-row items-center justify-between"><Text className="text-base font-bold text-ink">{children}</Text>{action}</View>
}

export function Avatar({ initials, large = false }: { initials: string; large?: boolean }) {
  return <View className={`${large ? 'h-[58px] w-[58px] rounded-[29px]' : 'h-[38px] w-[38px] rounded-[19px]'} items-center justify-center bg-brand-lime`}><Text className={`${large ? 'text-[17px]' : 'text-[11px]'} font-bold text-[#175E2D]`}>{initials}</Text></View>
}

export function Badge({ children, color = 'green' }: { children: ReactNode; color?: 'green' | 'red' | 'gray' | 'yellow' }) {
  const palette = { green: ['bg-brand-soft', 'text-brand'], red: ['bg-[#FBE3E5]', 'text-danger'], gray: ['bg-[#EEF1EE]', 'text-muted'], yellow: ['bg-amber-soft', 'text-amber'] }
  return <View className={`self-start rounded-full px-2 py-[5px] ${palette[color][0]}`}><Text className={`text-[9px] font-bold ${palette[color][1]}`}>{children}</Text></View>
}

export function PrimaryButton({ children, onPress, outline = false }: { children: ReactNode; onPress?: () => void; outline?: boolean }) {
  return <Pressable onPress={onPress} className={`min-h-[46px] items-center justify-center rounded-[10px] px-3.5 active:opacity-80 ${outline ? 'border border-brand bg-surface' : 'bg-brand'}`}><Text className={`text-[13px] font-bold ${outline ? 'text-brand' : 'text-white'}`}>{children}</Text></Pressable>
}
