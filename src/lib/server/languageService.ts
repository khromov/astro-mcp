import { query } from '$lib/server/db'
import { logAlways, logErrorAlways } from '$lib/log'

export interface LanguageInfo {
	code: string
	name: string
	fileCount: number
}

// Language code to display name mapping
const LANGUAGE_NAMES: Record<string, string> = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	it: 'Italian',
	ja: 'Japanese',
	ko: 'Korean',
	'pt-br': 'Portuguese (Brazil)',
	ru: 'Russian',
	'zh-cn': 'Chinese (Simplified)',
	'zh-tw': 'Chinese (Traditional)',
	ar: 'Arabic',
	nl: 'Dutch',
	pl: 'Polish',
	tr: 'Turkish',
	vi: 'Vietnamese',
	th: 'Thai',
	id: 'Indonesian',
	hi: 'Hindi',
	cs: 'Czech',
	da: 'Danish',
	fi: 'Finnish',
	el: 'Greek',
	he: 'Hebrew',
	hu: 'Hungarian',
	no: 'Norwegian',
	sv: 'Swedish',
	uk: 'Ukrainian'
}

export class LanguageService {
	/**
	 * Extract available languages from the content table
	 * Parses the path field to find unique language codes
	 */
	static async getAvailableLanguages(): Promise<LanguageInfo[]> {
		try {
			// Query to extract language codes from paths and count files per language
			// The language code is the directory immediately after 'src/content/docs/'
			const result = await query(`
				SELECT 
					CASE 
						WHEN path LIKE 'src/content/docs/%' THEN 
							SPLIT_PART(SUBSTRING(path FROM 'src/content/docs/(.*)'), '/', 1)
						ELSE NULL
					END AS language_code,
					COUNT(*) AS file_count
				FROM content
				WHERE path LIKE 'src/content/docs/%'
				GROUP BY language_code
				HAVING SPLIT_PART(SUBSTRING(path FROM 'src/content/docs/(.*)'), '/', 1) IS NOT NULL
				ORDER BY 
					CASE 
						WHEN SPLIT_PART(SUBSTRING(path FROM 'src/content/docs/(.*)'), '/', 1) = 'en' THEN 0
						ELSE 1
					END,
					language_code
			`)

			const languages: LanguageInfo[] = result.rows.map((row) => ({
				code: row.language_code,
				name: LANGUAGE_NAMES[row.language_code] || row.language_code,
				fileCount: parseInt(row.file_count)
			}))

			logAlways(`Found ${languages.length} languages in content table`)
			return languages
		} catch (error) {
			logErrorAlways('Error fetching available languages:', error)
			// Return English as fallback
			return [
				{
					code: 'en',
					name: 'English',
					fileCount: 0
				}
			]
		}
	}

	/**
	 * Get file count for a specific language
	 */
	static async getLanguageFileCount(languageCode: string): Promise<number> {
		try {
			const result = await query(
				`SELECT COUNT(*) as count 
				FROM content 
				WHERE path LIKE $1`,
				[`src/content/docs/${languageCode}/%`]
			)

			return parseInt(result.rows[0]?.count || '0')
		} catch (error) {
			logErrorAlways(`Error getting file count for language ${languageCode}:`, error)
			return 0
		}
	}

	/**
	 * Get the display name for a language code
	 */
	static getLanguageName(code: string): string {
		return LANGUAGE_NAMES[code] || code
	}

	/**
	 * Check if a language code is valid (exists in our mapping)
	 */
	static isValidLanguage(code: string): boolean {
		return code === 'en' || code in LANGUAGE_NAMES
	}
}
