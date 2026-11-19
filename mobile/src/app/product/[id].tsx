import { router, useLocalSearchParams } from 'expo-router'
import { Boxes, ChevronRight, CircleDollarSign, History, MoreHorizontal, Plus } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { MetricCard, Screen, SectionTitle } from '@/components/ui'
import { colors, money, products } from '@/constants/design'

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const product = products.find(p => p.id === id) ?? products[0]
  return <Screen back bottomNav={false} action={<MoreHorizontal size={22} color={colors.text}/>}><View className="flex-row items-center gap-3.5 py-1.5"><View className="h-[76px] w-[76px] items-center justify-center rounded-[14px] bg-[#F0F2EE]"><Text className="text-[42px]">{product.emoji}</Text></View><View><Text className="text-[19px] font-extrabold text-ink">{product.name}</Text><Text className="mt-[5px] text-[11px] text-muted">{product.unit}</Text></View></View><View className="my-4 flex-row gap-[9px]"><MetricCard icon={Boxes} label="Current stock" value={product.stock}/><MetricCard icon={CircleDollarSign} label="Selling price" value={`${money(product.price)} / bag`} plain/></View><Action icon={Plus} label="Add stock / adjustment" onPress={() => router.push({ pathname: '/adjust-stock', params: { id: product.id } })}/><Action icon={History} label="Stock history"/><SectionTitle>Stock history</SectionTitle><HistoryRow positive title="Stock added" meta="18 Jan 2026, 09:10 AM" value="+ 20 bag"/><HistoryRow title="Stock used (sale)" meta="17 Jan 2026, 03:42 PM" value="- 5 bag"/><HistoryRow positive title="Stock added" meta="10 Jan 2026, 11:26 AM" value="+ 10 bag"/></Screen>
}

function Action({ icon: Icon, label, onPress }: { icon: typeof Plus; label: string; onPress?: () => void }) {
  return <Pressable className="h-[50px] flex-row items-center gap-2.5 border-b border-line" onPress={onPress}><Icon size={18} color={colors.green}/><Text className="flex-1 text-[11px] font-bold text-ink">{label}</Text><ChevronRight size={17} color={colors.muted}/></Pressable>
}

function HistoryRow({ title, meta, value, positive = false }: { title: string; meta: string; value: string; positive?: boolean }) {
  return <View className="min-h-[58px] flex-row items-center gap-2.5 border-b border-line"><View className={`h-[34px] w-[34px] items-center justify-center rounded-[17px] ${positive ? 'bg-brand-soft' : 'bg-[#FBE3E5]'}`}><Text className={`font-extrabold ${positive ? 'text-brand' : 'text-danger'}`}>{positive ? '+' : '-'}</Text></View><View className="flex-1"><Text className="text-[11px] font-bold text-ink">{title}</Text><Text className="mt-[3px] text-[8px] text-muted">{meta}</Text></View><Text className={`text-[10px] font-bold ${positive ? 'text-brand' : 'text-danger'}`}>{value}</Text></View>
}

