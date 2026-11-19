import { Plus, ShoppingCart } from 'lucide-react-native'
import { Pressable, Text, View } from 'react-native'
import { Badge, Screen } from '@/components/ui'
import { colors, money } from '@/constants/design'

const sales = [['#S-0168', '21 Jan 2026, 04:21 PM', 3470, 'Credit'], ['#S-0167', '21 Jan 2026, 03:55 PM', 1260, 'Cash'], ['#S-0166', '21 Jan 2026, 02:40 PM', 850, 'Cash'], ['#S-0165', '21 Jan 2026, 01:18 PM', 2150, 'Credit'], ['#S-0164', '21 Jan 2026, 11:02 AM', 4200, 'Cash']]

export default function Sales() {
  return <Screen title="Sales" action={<Badge>Today</Badge>}><View className="mb-2 flex-row gap-[7px]"><Chip active text="All (68)"/><Chip text="Cash (46)"/><Chip text="Credit (22)"/></View>{sales.map(item => <View className="min-h-[66px] flex-row items-center gap-2.5 border-b border-line" key={item[0]}><View className="h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[#F0F5F0]"><ShoppingCart size={17} color={colors.green}/></View><View className="flex-1"><Text className="text-xs font-bold text-ink">{item[0]}</Text><Text className="mt-[3px] text-[8px] text-muted">{item[1]}</Text></View><View className="items-end gap-1"><Text className="text-[11px] font-bold text-ink">{money(Number(item[2]))}</Text><Badge color={item[3] === 'Cash' ? 'green' : 'yellow'}>{item[3]}</Badge></View></View>)}<Pressable className="mt-4 h-[42px] flex-row items-center gap-1.5 self-end rounded-[22px] bg-brand px-[15px]"><Plus size={17} color="#FFF"/><Text className="text-[11px] font-bold text-white">New sale</Text></Pressable></Screen>
}

function Chip({ text, active = false }: { text: string; active?: boolean }) {
  return <Pressable className={`flex-1 items-center rounded-[9px] py-2 ${active ? 'bg-brand-lime' : 'bg-[#F3F4F3]'}`}><Text className={`text-[9px] font-bold ${active ? 'text-brand' : 'text-muted'}`}>{text}</Text></Pressable>
}

