import { router } from 'expo-router'
import { ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/ui'
import { colors, products } from '@/constants/design'

export default function Products() {
  return <Screen title="Products" action={<Pressable className="h-[34px] flex-row items-center gap-[5px] rounded-[9px] bg-brand px-3"><Plus size={16} color="#FFF"/><Text className="text-[11px] font-bold text-white">Add</Text></Pressable>}><View className="h-[42px] flex-row items-center gap-2 rounded-[10px] bg-[#F3F5F3] px-2.5"><Search size={17} color={colors.muted}/><TextInput placeholder="Search product name or code" placeholderTextColor="#89918B" className="flex-1 text-[11px] text-ink"/><SlidersHorizontal size={17} color={colors.muted}/></View><View className="my-[11px] flex-row gap-1.5"><Chip active text="All (126)"/><Chip text="Low stock (7)"/><Chip text="Out of stock (2)"/></View>{products.map(product => <Pressable key={product.id} className="min-h-[66px] flex-row items-center gap-2.5 border-b border-line" onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}><View className="h-11 w-11 items-center justify-center rounded-[10px] bg-[#F0F2EE]"><Text className="text-[23px]">{product.emoji}</Text></View><View className="flex-1"><Text className="text-xs font-bold text-ink">{product.name}</Text><Text className="mt-1 text-[9px] text-muted">{product.unit} · Stock: {product.stock}</Text></View><ChevronRight size={17} color={colors.muted}/></Pressable>)}</Screen>
}

function Chip({ text, active = false }: { text: string; active?: boolean }) {
  return <Pressable className={`rounded-[9px] px-2 py-2 ${active ? 'bg-brand-lime' : 'bg-[#F3F4F3]'}`}><Text className={`text-[8px] font-bold ${active ? 'text-brand' : 'text-muted'}`}>{text}</Text></Pressable>
}

