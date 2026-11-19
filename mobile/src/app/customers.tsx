import { router } from 'expo-router'
import { ChevronRight, Plus, Search, SlidersHorizontal } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'
import { Avatar, Screen } from '@/components/ui'
import { colors, customers, money } from '@/constants/design'

export default function CustomersScreen() {
  return <Screen title="Customers" action={<Pressable className="h-[34px] flex-row items-center gap-[5px] rounded-[9px] bg-brand px-3"><Plus size={16} color="#FFF"/><Text className="text-[11px] font-bold text-white">Add</Text></Pressable>}><View className="h-[42px] flex-row items-center gap-2 rounded-[10px] bg-[#F3F5F3] px-2.5"><Search size={17} color={colors.muted}/><TextInput placeholder="Search by name or phone" placeholderTextColor="#89918B" className="flex-1 text-[11px] text-ink"/><SlidersHorizontal size={17} color={colors.muted}/></View><View className="my-[11px] flex-row gap-[7px]"><Chip active text="All (24)"/><Chip text="Has debt (9)"/><Chip text="Cleared (15)"/></View>{customers.map(customer => <Pressable key={customer.id} className="min-h-16 flex-row items-center gap-2.5 border-b border-line" onPress={() => router.push({ pathname: '/customer/[id]', params: { id: customer.id } })}><Avatar initials={customer.initials}/><View className="flex-1"><Text className="text-[13px] font-bold text-ink">{customer.name}</Text><Text className="mt-[3px] text-[9px] text-muted">{customer.phone}</Text></View><Text className={`text-[11px] font-bold ${customer.debt === 0 ? 'text-muted' : 'text-danger'}`}>{money(customer.debt)}</Text><ChevronRight size={17} color={colors.muted}/></Pressable>)}</Screen>
}

function Chip({ text, active = false }: { text: string; active?: boolean }) {
  return <Pressable className={`rounded-[9px] px-2.5 py-2 ${active ? 'bg-brand-lime' : 'bg-[#F3F4F3]'}`}><Text className={`text-[9px] font-bold ${active ? 'text-brand' : 'text-muted'}`}>{text}</Text></Pressable>
}

