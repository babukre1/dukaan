import { useState, type ReactNode } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { CalendarDays, Check } from 'lucide-react-native'
import { Text, TextInput, View } from 'react-native'
import { Avatar, PrimaryButton, Screen } from '@/components/ui'
import { colors, customers, money } from '@/constants/design'

export default function ReceivePayment() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const customer = customers.find(c => c.id === id) ?? customers[0]
  const [done, setDone] = useState(false)
  return <Screen title="Receive payment" back bottomNav={false}><View className="flex-row items-center gap-2.5 rounded-xl bg-[#F5F6F5] p-3"><Avatar initials={customer.initials}/><View><Text className="text-[13px] font-bold text-ink">{customer.name}</Text><Text className="mt-[3px] text-[9px] text-muted">{customer.phone}</Text></View></View><View className="mb-1.5 mt-2.5 rounded-[11px] bg-[#F1F3F1] p-3"><Text className="text-[9px] text-muted">Current debt</Text><Text className="mt-1 text-lg font-extrabold text-ink">{money(customer.debt)}</Text></View><Field label="Payment amount" required prefix="৳" value="2,000"/><Field label="Payment date" icon={<CalendarDays size={17} color={colors.muted}/>} value="21 Jan 2026"/><Text className="mb-1.5 mt-[13px] text-[10px] font-bold text-ink">Note <Text className="font-normal text-muted">(optional)</Text></Text><TextInput className="h-[72px] rounded-[9px] border border-[#D6DCD7] px-[11px] pt-[11px] text-xs text-ink" textAlignVertical="top" multiline defaultValue="Partial payment"/><View className="mt-[17px]"><PrimaryButton onPress={() => setDone(true)}>{done ? '✓ Payment recorded' : 'Receive payment'}</PrimaryButton></View>{done && <View className="mt-2.5 flex-row items-center gap-2 rounded-[9px] bg-brand-soft p-2.5"><Check size={17} color={colors.green}/><Text>Debt balance updated successfully.</Text></View>}</Screen>
}

function Field({ label, value, prefix, required = false, icon }: { label: string; value: string; prefix?: string; required?: boolean; icon?: ReactNode }) {
  return <><Text className="mb-1.5 mt-[13px] text-[10px] font-bold text-ink">{label} {required && <Text className="text-danger">*</Text>}</Text><View className="h-11 flex-row items-center gap-2 rounded-[9px] border border-[#D6DCD7] px-[11px]">{icon}{prefix && <Text className="text-[13px] text-ink">{prefix}</Text>}<TextInput className="flex-1 text-xs text-ink" defaultValue={value}/></View></>
}

