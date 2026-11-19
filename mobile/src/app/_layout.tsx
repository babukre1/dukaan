import '../../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { AuthProvider, useAuth } from '@/providers/auth'
import { colors } from '@/constants/design'

function Navigation(){const{session,loading}=useAuth();if(loading)return <View className="flex-1 items-center justify-center bg-surface"><ActivityIndicator color={colors.green}/></View>;return <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:'#FFFFFF'}}}><Stack.Protected guard={!session}><Stack.Screen name="login"/></Stack.Protected><Stack.Protected guard={!!session} redirectTo="/login"><Stack.Screen name="index"/><Stack.Screen name="change-password"/><Stack.Screen name="settings"/><Stack.Screen name="customers"/><Stack.Screen name="customer/[id]"/><Stack.Screen name="sales"/><Stack.Screen name="products"/><Stack.Screen name="product/[id]"/><Stack.Screen name="adjust-stock"/><Stack.Screen name="receive-payment"/></Stack.Protected></Stack>}
export default function RootLayout(){return <AuthProvider><StatusBar style="dark"/><Navigation/></AuthProvider>}
