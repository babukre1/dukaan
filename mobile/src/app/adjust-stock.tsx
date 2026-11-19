import { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CheckCircle2, Circle } from 'lucide-react-native'
import { Pressable, Text, TextInput, View } from 'react-native'
import { PrimaryButton, Screen } from '@/components/ui'
import { colors, products } from '@/constants/design'

export default function AdjustStock() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const product = products.find(p => p.id === id) ?? products[0]
  const [type, setType] = useState<'add' | 'adjust'>('add')
  return <Screen title="Add stock / adjustment" back bottomNav={false}><View className="mb-2 flex-row items-center gap-2.5 rounded-xl bg-brand-soft p-3"><View className="h-[45px] w-[45px] items-center justify-center rounded-[9px] bg-[#F0F2EE]"><Text className="text-2xl">{product.emoji}</Text></View><View><Text className="text-[13px] font-bold text-ink">{product.name}</Text><Text className="mt-[3px] text-[9px] text-muted">{product.unit}</Text></View></View><Choice selected={type === 'add'} title="Add stock" meta="Purchase / restock" onPress={() => setType('add')}/><Choice selected={type === 'adjust'} title="Stock adjustment" meta="Correction, damage, etc." onPress={() => setType('adjust')}/><Field label="Quantity" required value="20" suffix="bag"/><Field label="Purchase price" value="2,650" prefix="৳" suffix="per bag"/><Text className="mb-1.5 mt-[13px] text-[10px] font-bold text-ink">Note <Text className="font-normal text-muted">(optional)</Text></Text><TextInput className="h-[72px] rounded-[9px] border border-[#D6DCD7] px-[11px] pt-[11px] text-xs text-ink" textAlignVertical="top" multiline defaultValue="New stock from supplier"/><View className="mt-[17px]"><PrimaryButton>Update stock</PrimaryButton></View></Screen>
}

function Choice({ selected, title, meta, onPress }: { selected: boolean; title: string; meta: string; onPress: () => void }) {
  return <Pressable className="min-h-12 flex-row items-center gap-[9px]" onPress={onPress}>{selected ? <CheckCircle2 size={19} color={colors.green}/> : <Circle size={19} color="#A7AFA9"/>}<View><Text className="text-[11px] font-bold text-ink">{title}</Text><Text className="mt-[3px] text-[9px] text-muted">{meta}</Text></View></Pressable>
}

function Field({ label, value, prefix, suffix, required = false }: { label: string; value: string; prefix?: string; suffix?: string; required?: boolean }) {
  return <><Text className="mb-1.5 mt-[13px] text-[10px] font-bold text-ink">{label} {required && <Text className="text-danger">*</Text>}</Text><View className="h-11 flex-row items-center gap-2 rounded-[9px] border border-[#D6DCD7] px-[11px]">{prefix && <Text>{prefix}</Text>}<TextInput className="flex-1 text-xs text-ink" defaultValue={value}/>{suffix && <Text className="text-[10px] text-muted">{suffix}</Text>}</View></>
}

