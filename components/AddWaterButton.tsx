import { StyleSheet, TouchableOpacity, ViewStyle, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { LinearGradient } from 'expo-linear-gradient';

export interface AddWaterButtonProps {
  amount: number;
  onPress: () => void;
  style?: ViewStyle;
  primary?: boolean;
}

export default function AddWaterButton({ amount, onPress, style, primary }: AddWaterButtonProps) {
  const backgroundColor = useThemeColor({
    light: primary ? 'transparent' : 'rgba(0, 122, 255, 0.1)',
    dark: primary ? 'transparent' : 'rgba(10, 132, 255, 0.1)',
  }, 'background');

  const textColor = useThemeColor({
    light: primary ? '#FFFFFF' : '#007AFF',
    dark: primary ? '#FFFFFF' : '#0A84FF',
  }, 'text');

  return (
    <TouchableOpacity
      style={[styles.buttonContainer, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {primary ? (
        <LinearGradient
          colors={['#007AFF', '#00C7FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <ThemedText style={[styles.text, { color: textColor }]}>
            +{amount}ml
          </ThemedText>
        </LinearGradient>
      ) : (
        <View style={[styles.button, { backgroundColor }]}>
          <ThemedText style={[styles.text, { color: textColor }]}>
            +{amount}ml
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
    height: 80,
  },
  button: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
}); 