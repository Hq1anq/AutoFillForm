(async () => {
	/************** CONFIG ******************/
	const ANSWER_MAP_URL =
		"https://raw.githubusercontent.com/yourname/answers/main/answers.json";
	// 👉 Thay bằng link thật đến file JSON public trên cloud

	const SETTINGS = {
		caseInsensitive: true,
		scrollIntoView: false,
		verbose: true,
		keywordThreshold: 0.2, // tỷ lệ khớp tối thiểu nếu muốn mở rộng (0–1)
	};
	/****************************************/

	const log = (...msg) => SETTINGS.verbose && console.log("[AutoForm]", ...msg);
	const normalize = (str) =>
		SETTINGS.caseInsensitive
			? String(str || "")
					.toLowerCase()
					.trim()
			: String(str || "").trim();

	/** Load JSON từ URL **/
	async function loadAnswerMap(url) {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`❌ Không thể tải file JSON (${res.status})`);
		const data = await res.json();
		log(`✅ Tải thành công ${Object.keys(data).length} đáp án từ JSON`);
		return data;
	}

	/** 2️⃣ Tìm đáp án phù hợp trong map **/
	function matchQuestion(questionText, map) {
		const qNorm = normalize(questionText);
		for (const [keyword, answer] of Object.entries(map)) {
			if (qNorm.includes(normalize(keyword))) return answer;
		}
		return null;
	}

	/** Tìm lựa chọn khớp và click **/
	function selectAnswerInQuestion(questionEl, answerKeyword) {
		const normalizedAnswer = normalize(answerKeyword);
		const choiceEls = questionEl.querySelectorAll(
			'[data-automation-id="choiceItem"] input[type="radio"]'
		);
		for (const input of choiceEls) {
			const labelText = normalize(
				input.closest("label")?.innerText || input.getAttribute("value") || ""
			);
			if (
				labelText.includes(normalizedAnswer) ||
				normalizedAnswer.includes(labelText)
			) {
				if (SETTINGS.scrollIntoView)
					input.scrollIntoView({ behavior: "smooth", block: "center" });
				input.click();
				log(`🎯 Đã chọn đáp án "${labelText}"`);
				return true;
			}
		}
		log(`⚠️ Không tìm thấy lựa chọn phù hợp với keyword "${answerKeyword}"`);
		return false;
	}

	/** Hàm chính **/
	async function autoFillForm() {
		const map = await loadAnswerMap(ANSWER_MAP_URL);
		const questions = document.querySelectorAll(
			'[data-automation-id="questionItem"]'
		);
		log(`🔍 Tìm thấy ${questions.length} câu hỏi.`);

		let successCount = 0;
		for (const q of questions) {
			const questionText =
				q
					.querySelector('[data-automation-id="questionTitle"]')
					?.innerText?.trim() || "";
			if (!questionText) continue;

			const answer = matchQuestion(questionText, map);
			if (!answer) {
				log(`❓ Không tìm thấy đáp án cho: "${questionText.slice(0, 70)}..."`);
				continue;
			}

			const ok = selectAnswerInQuestion(q, answer);
			if (ok) successCount++;
		}

		log(`✅ Hoàn tất: ${successCount}/${questions.length} câu đã được điền.`);
	}

	await autoFillForm();
})();
