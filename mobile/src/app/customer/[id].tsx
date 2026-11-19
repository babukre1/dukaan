import { router, useLocalSearchParams } from 'expo-router'
import { CreditCard, MoreHorizontal, ShoppingCart, WalletCards } from 'lucide-react-native'
import { Text, View } from 'react-native'
import { Avatar, MetricCard, PrimaryButton, Screen, SectionTitle } from '@/components/ui'
import { colors, customers, money } from '@/constants/design'

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const customer = customers.find(c => c.id === id) ?? customers[0]
  return <Screen back bottomNav={false} action={<MoreHorizontal size={22} color={colors.text}/>} contentClassName="items-center"><Avatar initials={customer.initials} large/><Text className="mt-2 text-xl font-extrabold text-ink">{customer.name}</Text><Text className="mt-[3px] text-[11px] text-muted">{customer.phone}</Text><View className="mt-[18px] w-full flex-row gap-[9px]"><MetricCard icon={CreditCard} label="Total debt" value={money(customer.debt)}/><MetricCard icon={WalletCards} label="Total paid" value={money(28600)} plain/></View><View className="mt-3 w-full flex-row gap-2"><View className="flex-[1.2]"><PrimaryButton onPress={() => router.push({ pathname: '/receive-payment', params: { id: customer.id } })}>Receive payment</PrimaryButton></View><View className="flex-[0.8]"><PrimaryButton outline>Add debt</PrimaryButton></View></View><View className="w-full"><SectionTitle action={<Text className="rounded-full bg-[#F1F3F1] px-[9px] py-[5px] text-[10px] font-bold text-muted">All</Text>}>Transaction history</SectionTitle><Transaction icon={ShoppingCart} title="Sale (Credit)" meta="20 Jan 2026, 10:24 AM" value="+ ৳1,200"/><Transaction icon={WalletCards} title="Payment received" meta="18 Jan 2026, 04:12 PM" value="- ৳2,000" positive/><Transaction icon={ShoppingCart} title="Sale (Credit)" meta="15 Jan 2026, 11:03 AM" value="+ ৳3,500"/></View></Screen>
}

function Transaction({ icon: Icon, title, meta, value, positive = false }: { icon: typeof ShoppingCart; title: string; meta: string; value: string; positive?: boolean }) {
  return <View className="min-h-[61px] flex-row items-center gap-[9px] border border-b-0 border-line px-2.5"><View className="h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#F0F5F0]"><Icon size={17} color={colors.green}/></View><View className="flex-1"><Text className="text-[11px] font-bold text-ink">{title}</Text><Text className="mt-[3px] text-[8px] text-muted">{meta}</Text></View><Text className={`text-[10px] font-bold ${positive ? 'text-brand' : 'text-danger'}`}>{value}</Text></View>
}

