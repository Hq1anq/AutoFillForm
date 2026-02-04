(async () => {
	/************** CONFIG ******************/
	const ANSWER_MAP_URL =
		"https://raw.githubusercontent.com/hq1anq/AutoFillForm/main/qc.json";
	const SELECTOR_QUESTION_ITEM = '[data-automation-id="questionItem"]';
	const SELECTOR_QUESTION_TEXT = '[data-automation-id="questionTitle"]';
	const SELECTOR_RADIO_INPUT =
		'[data-automation-id="choiceItem"] input[type="radio"]';
	const SELECTOR_TEXT_INPUT = 'textarea[data-automation-id="textInput"]'; // dùng để phát hiện câu tự luận
	const SELECTOR_CHECKBOX_INPUT =
		'[data-automation-id="choiceItem"] input[type="checkbox"]';

	const SETTINGS = {
		caseInsensitive: true,
		verbose: true,
		keywordThreshold: 0.2, // tỷ lệ khớp tối thiểu nếu muốn mở rộng (0–1)
	};
	/****************************************/

	/** Load JSON từ URL **/
	async function loadAnswerMap(url) {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`❌ Không thể tải file JSON (${res.status})`);
		const data = await res.json();
		console.log(
			`✅ Tải thành công ${
				data.length || Object.keys(data).length
			} đáp án từ JSON`
		);
		return data;
	}

	const normalize = (str) =>
		SETTINGS.caseInsensitive
			? String(str || "")
					.toLowerCase()
					.trim()
			: String(str || "").trim();

	/** Tìm đáp án phù hợp trong map **/
	function matchQuestion(questionText, qItem, map) {
		const qNorm = normalize(questionText);
		const choices = Array.from(
			qItem.querySelectorAll(
				`${SELECTOR_RADIO_INPUT}, ${SELECTOR_CHECKBOX_INPUT}`
			)
		).map((el) =>
			normalize(
				el.closest("label")?.innerText || el.getAttribute("value") || ""
			)
		);

		let candidates = [];

		if (Array.isArray(map)) {
			candidates = map.filter((item) =>
				qNorm.includes(normalize(item.question))
			);

			if (!candidates.length) return null;

			const isMulti =
				qItem.querySelectorAll(SELECTOR_CHECKBOX_INPUT).length > 0;

			if (isMulti) {
				// checkbox → chọn nhiều đáp án
				let matchedAnswers = [];
				for (const c of candidates) {
					const answers = Array.isArray(c.answer) ? c.answer : [c.answer];
					for (const ans of answers) {
						const ansNorm = normalize(ans);
						if (
							choices.some((ch) => ch.includes(ansNorm) || ansNorm.includes(ch))
						) {
							matchedAnswers.push(ans);
						}
					}
					if (matchedAnswers.length)
						return { question: questionText, answer: matchedAnswers };
				}
			} else {
				// radio → chọn đúng 1 đáp án khớp
				for (const c of candidates) {
					const ansNorm = normalize(
						Array.isArray(c.answer) ? c.answer[0] : c.answer
					);
					if (
						choices.some((ch) => ch.includes(ansNorm) || ansNorm.includes(ch))
					) {
						return {
							question: questionText,
							answer: Array.isArray(c.answer) ? c.answer[0] : c.answer,
						};
					}
				}
			}
		} else {
			const foundKey = Object.keys(map).find((key) =>
				qNorm.includes(normalize(key))
			);
			if (foundKey) return { question: foundKey, answer: map[foundKey] };
		}
		return null;
	}

	/** Tìm lựa chọn khớp và click **/
	function selectAnswerInQuestion(questionEl, answerKeyword, index) {
		const isMulti =
			questionEl.querySelectorAll(SELECTOR_CHECKBOX_INPUT).length > 0;

		const answers = Array.isArray(answerKeyword)
			? answerKeyword
			: [answerKeyword];

		const inputs = questionEl.querySelectorAll(
			isMulti ? SELECTOR_CHECKBOX_INPUT : SELECTOR_RADIO_INPUT
		);

		let selectedLabels = [];

		for (const ans of answers) {
			const normalizedAnswer = normalize(ans);
			for (const choice of inputs) {
				const labelText = normalize(
					choice.closest("label")?.innerText ||
						choice.getAttribute("value") ||
						""
				);
				if (
					labelText.includes(normalizedAnswer) ||
					normalizedAnswer.includes(labelText)
				) {
					if (!choice.checked) choice.click();
					selectedLabels.push(labelText);
					break;
				}
			}
		}
		if (selectedLabels.length > 0) {
			if (isMulti) {
				console.log(
					`🎯 [Câu ${index + 1}] Đã chọn ${
						selectedLabels.length
					} đáp án: ${selectedLabels.map((l) => `"${l}"`).join(", ")}`
				);
			} else {
				console.log(
					`🎯 [Câu ${index + 1}] Đã chọn đáp án "${selectedLabels[0]}"`
				);
			}
			return true;
		} else {
			console.log(
				`⚠️ [Câu ${
					index + 1
				}] Không tìm thấy lựa chọn phù hợp cho: "${answers.join(", ")}"`
			);
			return false;
		}
	}

	/** Hàm chính **/
	async function autoFillForm() {
		const map = await loadAnswerMap(ANSWER_MAP_URL);
		const questions = document.querySelectorAll(SELECTOR_QUESTION_ITEM);

		if (!questions.length) {
			console.warn(
				"⚠️ Không tìm thấy phần tử câu hỏi — vui lòng kiểm tra SELECTOR_QUESTION_ITEM!"
			);
			return;
		} else console.log(`🔍 Tìm thấy ${questions.length} câu hỏi.`);

		let successCount = 0;
		let skippedQuestions = [];

		questions.forEach((qItem, index) => {
			const questionText =
				qItem.querySelector(SELECTOR_QUESTION_TEXT)?.innerText.trim() || "";

			if (!questionText) return;

			// Nếu câu hỏi là dạng text (có textarea) thì skip
			if (qItem.querySelector(SELECTOR_TEXT_INPUT)) {
				qItem.style.border = "3px solid orange";
				skippedQuestions.push({ index: index + 1, text: questionText });
				if (SETTINGS.debug)
					console.log(
						`✏️ [Câu ${index + 1}] Phát hiện câu hỏi tự luận — đã skip.`
					);
				return;
			}

			// ✅ Nếu là câu hỏi nhiều đáp án (checkbox)
			const checkboxInputs = qItem.querySelectorAll(SELECTOR_CHECKBOX_INPUT);

			const matched = matchQuestion(questionText, qItem, map);
			if (!matched) {
				console.log(
					`❌ [Câu ${
						index + 1
					}] Không có đáp án trong JSON cho: "${questionText}"`
				);
				return;
			}

			const ok = selectAnswerInQuestion(qItem, matched.answer, index);
			if (ok) successCount++;
		});

		console.log(
			`✅ Hoàn tất: ${successCount}/${questions.length} câu đã được điền.`
		);

		if (skippedQuestions.length) {
			const indexes = skippedQuestions.map((q) => q.index).join(", ");
			console.warn(
				`🟠 Có ${skippedQuestions.length} câu tự luận cần tự điền: ${indexes}`
			);
		}
	}

	await autoFillForm();
})();
