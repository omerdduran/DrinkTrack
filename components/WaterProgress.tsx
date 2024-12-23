import { StyleSheet, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface WaterProgressProps {
  progress: { addListener: (callback: (state: { value: number }) => void) => void; removeAllListeners: () => void; };
}

export default function WaterProgress({ progress }: WaterProgressProps) {
  const size = Dimensions.get('window').width * 0.6;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progress.addListener(({ value }) => {
      progressValue.value = withSpring(value, {
        damping: 15,
        stiffness: 100,
      });
    });

    return () => {
      progress.removeAllListeners();
    };
  }, []);

  const animatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: circumference * (1 - progressValue.value),
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.circleContainer}>
        <Svg width={size} height={size}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(0, 122, 255, 0.1)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress Circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#007AFF"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
          />
        </Svg>
        <LinearGradient
          colors={['#007AFF', '#00C7FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientOverlay, { width: size, height: size }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 300,
  },
  circleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.1,
  },
});