import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Redimensionne et compresse la photo avant envoi à l'IA.
 *
 * Une photo de téléphone brute (4000x3000, plusieurs Mo) est inutilement
 * lourde : elle consomme beaucoup de tokens vision, ralentit fortement la
 * réponse et épuise plus vite le quota gratuit. 768px de large suffisent
 * largement pour juger d'une morphologie ou identifier un plat.
 */
export async function photoToBase64(uri: string, maxWidth = 640): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { base64: true, compress: 0.55, format: ImageManipulator.SaveFormat.JPEG },
  );
  if (!result.base64) throw new Error('Échec de la compression de la photo');
  return result.base64;
}
