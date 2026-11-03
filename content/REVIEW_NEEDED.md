# Content to double-check

Items for a native speaker to check. Remove an entry once checked.

| Where | Item | Why it's flagged |
|---|---|---|
| u01-greetings | 米格 Mǐgé (your name, "Mi'ge") | Characters guessed from the sound: 米 mǐ is the standard first character for "Mi-" names; for "ge" the common options are 格 gé (used in foreign names, e.g. 米格尔 for Miguel) or 哥 gē ("older brother" , an affectionate nickname like 米哥 "brother Mi"). Ask which one her family uses , and the tones , then update `w-mikkel` in `content/units/01-greetings.json` (search-and-replace 米格 / Mǐgé in all unit files). Audio regenerates automatically. |
| u01-greetings | 哪里哪里！ as a reply to a compliment | The classic modest reply, but some younger speakers find it a bit old-fashioned and just say 谢谢 or 没有没有. Still useful to recognise. |
| u00-basics | 你好吗？ | Common in textbooks; in real life friends more often skip it or say 最近怎么样？ Kept because it's universally understood. |
| u00-basics | 啊，对不起！ written À | The tone of 啊 varies with the speaker's mood; the audio may not match the tone mark exactly. |
| u10-experiences | 北京人很多，哥本哈根安静多了。 | Meant as "Beijing is crowded; Copenhagen is much quieter". Check it sounds natural; 北京人太多了 may be more idiomatic. |
| u10-experiences | 过 tagged HSK 4, 对 tagged HSK 4 | The downloaded HSK list puts these standalone characters at level 4, although they're used much earlier. Harmless; just a label. |
| u12-travel | 行李被我放在宾馆了。 | A 被 example with yourself as the doer; 我把行李放在宾馆了 is the more everyday way to say it. Kept to show the pattern; check it doesn't sound odd. |
| u15-phone | 喂 written wèi | The dictionary tone is wèi, but on the phone people usually say a rising wéi. Typed answers accept wèi. |
| u15-phone | 先生 / 小姐 | Both are fine in formal settings. 小姐 for a waitress can sound off in parts of China, hence the note to use 服务员. |
| u17-understand | 第一题我做错了。 | 我错了一道题 or 第一道题我做错了 may be more natural; 道 isn't taught yet. |
| u18-outandabout | 我坐一路公共汽车。 written yī lù | Bus numbers keep 一 as yī (or yāo in some contexts). Check this reads naturally. |
| u19-movingin | 我来刷碗！ | 刷碗 is northern and common in Beijing; 洗碗 is universal. |
| u23-study | 小雨 (her niece) | A made-up name for the niece in the stories. |
| u26-festival | 我们要好好照顾爷爷奶奶。 written hǎohǎo | Beijingers often say hǎohāor with an r. Typed answers accept hǎohǎo. |
| u28-oneyear | 你们是什么关系？ | Very common question, but can feel direct. English gloss softened to "How do you two know each other?". |

## Vocabulary sentences (content/data/sentences.json)
- Sentence pinyin is built from each word's dictionary reading. Common polyphones (得 地 还 长 只 干…) are chosen by context rules in `scripts/build-vocab.ts`; rarer ones take the reading learned first and may be wrong.
- Known weak spot: a verb + 得到 / 得了 potential complement (听得到 should be tīng de dào) is split as 听 + 得到 (dédào).
- Tatoeba sentences are community-written. They are filtered, not hand-checked; the "report bad audio/sentence" button (step 5) will feed fixes back.

## Generated example sentences (28 Oct 2026; 168 added or rewritten 3 Nov 2026 for the level cap, IDEAS #17)

Written for this app for HSK 1–4 words that had no Tatoeba or course sentence (`content/generated-sentences.json`). Please check they sound natural; fix or delete a line and the next vocabulary build picks it up. Pinyin uses dictionary tones (yī gè, bù shì), like the Tatoeba sentences.

| Word | Sentence | Pinyin | English |
|---|---|---|---|
| 您 nín | 老师，您好！ | Lǎoshī, nín hǎo! | Hello, teacher! (polite) |
| 打球 dǎ qiú | 我们下午去打球吧。 | Wǒmen xiàwǔ qù dǎqiú ba. | Let's go and play ball this afternoon. |
| 里边 lǐ bian | 里边有很多人。 | Lǐbian yǒu hěn duō rén. | There are a lot of people inside. |
| 本子 běn zi | 这是我的本子。 | Zhè shì wǒ de běnzi. | This is my notebook. |
| 后边 hòu bian | 学校后边有一个公园。 | Xuéxiào hòubian yǒu yī gè gōngyuán. | There's a park behind the school. |
| 包子 bāo zi | 我早上吃了两个包子。 | Wǒ zǎoshang chī le liǎng gè bāozi. | I had two steamed buns this morning. |
| 前边 qián bian | 前边就是医院。 | Qiánbian jiù shì yīyuàn. | The hospital is just ahead. |
| 网友 wǎng yǒu | 他是我的网友。 | Tā shì wǒ de wǎngyǒu. | He's a friend I met online. |
| 听写 tīng xiě | 今天我们有听写。 | Jīntiān wǒmen yǒu tīngxiě. | We have a dictation today. |
| 面条儿 miàn tiáor | 我想吃面条儿。 | Wǒ xiǎng chī miàntiáor. | I'd like to eat noodles. |
| 倒 dào | 请给我倒一杯水。 | Qǐng gěi wǒ dào yī bēi shuǐ. | Please pour me a glass of water. |
| 高级 gāo jí | 这是一家高级饭店。 | Zhè shì yī jiā gāojí fàndiàn. | This is a high-end restaurant. |
| 周年 zhōu nián | 今天是我们结婚十周年。 | Jīntiān shì wǒmen jiéhūn shí zhōunián. | Today is our tenth wedding anniversary. |
| 例如 lì rú | 我喜欢运动，例如跑步。 | Wǒ xǐhuan yùndòng, lìrú pǎobù. | I like sport, for example running. |
| 这时 zhè shí | 这时，电话响了。 | Zhè shí, diànhuà xiǎng le. | Just then, the phone rang. |
| 旅客 lǚ kè | 车上的旅客都很累。 | Chē shang de lǚkè dōu hěn lèi. | The passengers on the train are all tired. |
| 院长 yuàn zhǎng | 医院的院长是一个医生。 | Yīyuàn de yuànzhǎng shì yī gè yīshēng. | The head of the hospital is a doctor. |
| 东北 dōng běi | 东北的冬天很冷。 | Dōngběi de dōngtiān hěn lěng. | Winters in the northeast are very cold. |
| 中年 zhōng nián | 我爸爸是中年人。 | Wǒ bàba shì zhōngnián rén. | My dad is middle-aged. |
| 名称 míng chēng | 这个公司的名称是什么？ | Zhège gōngsī de míngchēng shì shénme? | What's the name of this company? |
| 举手 jǔ shǒu | 知道的同学请举手。 | Zhīdào de tóngxué qǐng jǔshǒu. | Raise your hand if you know. |
| 西南 xī nán | 这个城市在中国西南。 | Zhège chéngshì zài Zhōngguó xīnán. | This city is in southwest China. |
| 西北 xī běi | 西北有很多山。 | Xīběi yǒu hěn duō shān. | There are many mountains in the northwest. |
| 住房 zhù fáng | 这里的住房很贵。 | Zhèlǐ de zhùfáng hěn guì. | Housing here is expensive. |
| 体育馆 tǐ yù guǎn | 我们在体育馆打球。 | Wǒmen zài tǐyùguǎn dǎqiú. | We play ball in the sports hall. |
| 打印 dǎ yìn | 请帮我打印一下。 | Qǐng bāng wǒ dǎyìn yīxià. | Please print this for me. |
| 老年 lǎo nián | 老年人要多休息。 | Lǎonián rén yào duō xiūxi. | Old people need plenty of rest. |
| 照相 zhào xiàng | 我们在这儿照相吧。 | Wǒmen zài zhèr zhàoxiàng ba. | Let's take a photo here. |
| 药店 yào diàn | 前边有一家药店。 | Qiánbian yǒu yī jiā yàodiàn. | There's a pharmacy up ahead. |
| 班长 bān zhǎng | 他是我们的班长。 | Tā shì wǒmen de bānzhǎng. | He's our class monitor. |
| 里头 lǐ tou | 包里头有什么？ | Bāo lǐtou yǒu shénme? | What's in the bag? |
| 东南 dōng nán | 风从东南来。 | Fēng cóng dōngnán lái. | The wind is coming from the southeast. |
| 站住 zhàn zhù | 站住！别走！ | Zhànzhù! Bié zǒu! | Stop! Don't go! |
| 开机 kāi jī | 我的手机开不了机。 | Wǒ de shǒujī kāi bu liǎo jī. | My phone won't turn on. |
| 干杯 gān bēi | 为我们的朋友干杯！ | Wèi wǒmen de péngyou gānbēi! | To our friends, cheers! |
| 方便面 fāng biàn miàn | 我晚上吃了方便面。 | Wǒ wǎnshang chī le fāngbiànmiàn. | I had instant noodles tonight. |
| 球鞋 qiú xié | 我买了一双新球鞋。 | Wǒ mǎi le yī shuāng xīn qiúxié. | I bought a new pair of trainers. |
| 晚报 wǎn bào | 爷爷每天看晚报。 | Yéye měitiān kàn wǎnbào. | Grandpa reads the evening paper every day. |
| 药水 yào shuǐ | 这个药水一天喝三次。 | Zhège yàoshuǐ yī tiān hē sān cì. | Take this liquid medicine three times a day. |
| 中医 Zhōng yī | 她妈妈是中医。 | Tā māma shì zhōngyī. | Her mum is a doctor of Chinese medicine. |
| 前年 qián nián | 我前年去了北京。 | Wǒ qiánnián qù le Běijīng. | I went to Beijing the year before last. |
| 叫作 jiào zuò | 这种花叫作什么？ | Zhè zhǒng huā jiàozuò shénme? | What's this kind of flower called? |
| 中级 zhōng jí | 我在上中级班。 | Wǒ zài shàng zhōngjí bān. | I'm in the intermediate class. |
| 西医 xī yī | 他看了西医，也看了中医。 | Tā kàn le xīyī, yě kàn le zhōngyī. | He saw a Western doctor and a Chinese one. |
| 考生 kǎo shēng | 考生们都很紧张。 | Kǎoshēngmen dōu hěn jǐnzhāng. | The candidates are all nervous. |
| 读音 dú yīn | 这个字的读音是什么？ | Zhège zì de dúyīn shì shénme? | How is this character pronounced? |
| 中小学 zhōng xiǎo xué | 中小学明天放假。 | Zhōngxiǎoxué míngtiān fàngjià. | Schools are closed tomorrow. |
| 西餐 xī cān | 你喜欢吃西餐吗？ | Nǐ xǐhuan chī xīcān ma? | Do you like Western food? |
| 不一会儿 bù yī huìr | 不一会儿，他就回来了。 | Bù yīhuìr, tā jiù huílai le. | He was back in no time. |
| 干活儿 gàn huór | 他在外面干活儿。 | Tā zài wàimiàn gànhuór. | He's working outside. |
| 笑话儿 xiào huar | 爸爸给我讲了一个笑话儿。 | Bàba gěi wǒ jiǎng le yī gè xiàohuar. | Dad told me a joke. |
| 有空儿 yǒu kòngr | 你明天有空儿吗？ | Nǐ míngtiān yǒu kòngr ma? | Are you free tomorrow? |
| 了 liǎo | 这么多菜，我吃不了。 | Zhème duō cài, wǒ chī bu liǎo. | That's more food than I can eat. |
| 为 wéi | 大家选他为班长。 | Dàjiā xuǎn tā wéi bānzhǎng. | Everyone chose him as class monitor. |
| 行 háng | 请看第三行。 | Qǐng kàn dì sān háng. | Please look at line three. |
| 重 chóng | 请你重写一遍。 | Qǐng nǐ chóng xiě yī biàn. | Please write it again. |
| 精神 jīng shen | 你今天很精神。 | Nǐ jīntiān hěn jīngshen. | You look full of energy today. |
| 调 tiáo | 房间太冷了，把空调调高一点儿。 | Fángjiān tài lěng le, bǎ kōngtiáo tiáo gāo yīdiǎnr. | The room's too cold; turn the heating up a bit. |
| 对象 duì xiàng | 你有对象了吗？ | Nǐ yǒu duìxiàng le ma? | Are you seeing someone? |
| 决赛 jué sài | 我们进了决赛！ | Wǒmen jìn le juésài! | We made it to the final! |
| 厂 chǎng | 他在一家工厂上班。 | Tā zài yī jiā gōngchǎng shàngbān. | He works at a factory. |
| 配合 pèi hé | 我们配合得很好。 | Wǒmen pèihé de hěn hǎo. | We work very well together. |
| 结合 jié hé | 学习要和生活结合起来。 | Xuéxí yào hé shēnghuó jiéhé qǐlai. | Study should be linked to daily life. |
| 公布 gōng bù | 考试成绩明天公布。 | Kǎoshì chéngjì míngtiān gōngbù. | The exam results come out tomorrow. |
| 动力 dòng lì | 家人是我学习的动力。 | Jiārén shì wǒ xuéxí de dònglì. | My family is my motivation to study. |
| 领先 lǐng xiān | 我们队现在领先。 | Wǒmen duì xiànzài lǐngxiān. | Our team is in the lead now. |
| 声明 shēng míng | 公司发了一个声明。 | Gōngsī fā le yī gè shēngmíng. | The company issued a statement. |
| 路线 lù xiàn | 我们走哪条路线？ | Wǒmen zǒu nǎ tiáo lùxiàn? | Which route shall we take? |
| 深入 shēn rù | 我们要深入了解这个问题。 | Wǒmen yào shēnrù liǎojiě zhège wèntí. | We need to understand this problem in depth. |
| 加强 jiā qiáng | 我要加强口语练习。 | Wǒ yào jiāqiáng kǒuyǔ liànxí. | I need to do more speaking practice. |
| 把握 bǎ wò | 这次考试我很有把握。 | Zhè cì kǎoshì wǒ hěn yǒu bǎwò. | I'm confident about this exam. |
| 主持 zhǔ chí | 今天的会由她主持。 | Jīntiān de huì yóu tā zhǔchí. | She's chairing today's meeting. |
| 直播 zhí bō | 比赛在电视上直播。 | Bǐsài zài diànshì shang zhíbō. | The match is shown live on TV. |
| 各自 gè zì | 下课以后，大家各自回家。 | Xiàkè yǐhòu, dàjiā gèzì huí jiā. | After class, everyone went their own way home. |
| 体会 tǐ huì | 我体会到了学中文的快乐。 | Wǒ tǐhuì dào le xué Zhōngwén de kuàilè. | I've come to feel the joy of learning Chinese. |
| 高速 gāo sù | 我们走高速吧。 | Wǒmen zǒu gāosù ba. | Let's take the motorway. |
| 欢乐 huān lè | 新年是一个欢乐的节日。 | Xīnnián shì yī gè huānlè de jiérì. | New Year is a joyful holiday. |
| 加快 jiā kuài | 我们得加快速度。 | Wǒmen děi jiākuài sùdù. | We need to speed up. |
| 带领 dài lǐng | 老师带领学生去参观。 | Lǎoshī dàilǐng xuésheng qù cānguān. | The teacher took the students on a visit. |
| 体现 tǐ xiàn | 这件事体现了他的能力。 | Zhè jiàn shì tǐxiàn le tā de nénglì. | This shows what he's capable of. |
| 难度 nán dù | 这次考试难度很大。 | Zhè cì kǎoshì nándù hěn dà. | This exam is very difficult. |
| 反复 fǎn fù | 我反复听了很多遍。 | Wǒ fǎnfù tīng le hěn duō biàn. | I listened to it over and over. |
| 初步 chū bù | 我们有了一个初步的计划。 | Wǒmen yǒu le yī gè chūbù de jìhuà. | We have a rough plan. |
| 比例 bǐ lì | 我们班男女生的比例是一比一。 | Wǒmen bān nánnǚshēng de bǐlì shì yī bǐ yī. | Our class is half boys, half girls. |
| 输入 shū rù | 请输入你的名字。 | Qǐng shūrù nǐ de míngzi. | Please enter your name. |
| 总结 zǒng jié | 最后，我来总结一下。 | Zuìhòu, wǒ lái zǒngjié yīxià. | Finally, let me sum up. |
| 另一方面 lìng yī fāng miàn | 另一方面，这样也很贵。 | Lìng yī fāngmiàn, zhèyàng yě hěn guì. | On the other hand, it's also expensive. |
| 认可 rèn kě | 他的能力得到了大家的认可。 | Tā de nénglì dédào le dàjiā de rènkě. | Everyone recognises his ability. |
| 家属 jiā shǔ | 病人的家属在外面等。 | Bìngrén de jiāshǔ zài wàimiàn děng. | The patient's family are waiting outside. |
| 坚决 jiān jué | 他坚决不同意。 | Tā jiānjué bù tóngyì. | He's firmly against it. |
| 设立 shè lì | 学校设立了一个新专业。 | Xuéxiào shèlì le yī gè xīn zhuānyè. | The university set up a new programme. |
| 手续 shǒu xù | 手续都办好了。 | Shǒuxù dōu bàn hǎo le. | All the paperwork is done. |
| 录音 lù yīn | 请听录音。 | Qǐng tīng lùyīn. | Please listen to the recording. |
| 北部 běi bù | 北部比南部冷。 | Běibù bǐ nánbù lěng. | The north is colder than the south. |
| 适用 shì yòng | 这个方法很适用。 | Zhège fāngfǎ hěn shìyòng. | This method works well. |
| 完善 wán shàn | 这里的服务很完善。 | Zhèlǐ de fúwù hěn wánshàn. | The services here are excellent. |
| 短期 duǎn qī | 我在北京短期学习。 | Wǒ zài Běijīng duǎnqī xuéxí. | I'm on a short study stay in Beijing. |
| 全场 quán chǎng | 全场的人都站了起来。 | Quánchǎng de rén dōu zhàn le qǐlai. | Everyone in the hall stood up. |
| 开展 kāi zhǎn | 学校开展了很多活动。 | Xuéxiào kāizhǎn le hěn duō huódòng. | The school put on lots of activities. |
| 美食 měi shí | 北京有很多美食。 | Běijīng yǒu hěn duō měishí. | Beijing has lots of good food. |
| 推广 tuī guǎng | 他们在推广新产品。 | Tāmen zài tuīguǎng xīn chǎnpǐn. | They're promoting a new product. |
| 古代 gǔ dài | 古代的人也喜欢喝茶。 | Gǔdài de rén yě xǐhuan hē chá. | People in ancient times liked tea too. |
| 中华民族 Zhōng huá mín zú | 春节是中华民族的节日。 | Chūnjié shì Zhōnghuá mínzú de jiérì. | Spring Festival is a festival of the Chinese people. |
| 加工 jiā gōng | 这些水果要加工一下。 | Zhèxiē shuǐguǒ yào jiāgōng yīxià. | This fruit needs to be processed. |
| 中部 zhōng bù | 他家住在中国中部。 | Tā jiā zhù zài Zhōngguó zhōngbù. | His family lives in central China. |
| 束 shù | 我送了她一束花。 | Wǒ sòng le tā yī shù huā. | I gave her a bunch of flowers. |
| 办理 bàn lǐ | 我去银行办理手续。 | Wǒ qù yínháng bànlǐ shǒuxù. | I'm going to the bank to sort out the paperwork. |
| 规范 guī fàn | 你的发音很规范。 | Nǐ de fāyīn hěn guīfàn. | Your pronunciation is very standard. |
| 歌迷 gē mí | 她是这个歌手的歌迷。 | Tā shì zhège gēshǒu de gēmí. | She's a fan of this singer. |
| 民间 mín jiān | 这是一个民间故事。 | Zhè shì yī gè mínjiān gùshi. | This is a folk tale. |
| 初中 chū zhōng | 我妹妹在上初中。 | Wǒ mèimei zài shàng chūzhōng. | My younger sister is in middle school. |
| 一方面 yī fāng miàn | 一方面我想去，一方面我没有时间。 | Yī fāngmiàn wǒ xiǎng qù, yī fāngmiàn wǒ méiyǒu shíjiān. | On the one hand I want to go, on the other I have no time. |
| 动人 dòng rén | 这个故事很动人。 | Zhège gùshi hěn dòngrén. | This story is very moving. |
| 开业 kāi yè | 这家饭馆明天开业。 | Zhè jiā fànguǎn míngtiān kāiyè. | This restaurant opens tomorrow. |
| 生动 shēng dòng | 老师讲得很生动。 | Lǎoshī jiǎng de hěn shēngdòng. | The teacher explains things vividly. |
| 彩色 cǎi sè | 这是一张彩色照片。 | Zhè shì yī zhāng cǎisè zhàopiàn. | This is a colour photo. |
| 单元 dān yuán | 我们学到第三单元了。 | Wǒmen xué dào dì sān dānyuán le. | We've got to unit three. |
| 海关 hǎi guān | 我们在海关等了很久。 | Wǒmen zài hǎiguān děng le hěn jiǔ. | We waited a long time at customs. |
| 自觉 zì jué | 他很自觉，每天都学习。 | Tā hěn zìjué, měitiān dōu xuéxí. | He's very self-disciplined and studies every day. |
| 收看 shōu kàn | 很多人收看了这场比赛。 | Hěn duō rén shōukàn le zhè chǎng bǐsài. | A lot of people watched the match. |
| 公务员 gōng wù yuán | 她爸爸是公务员。 | Tā bàba shì gōngwùyuán. | Her dad is a civil servant. |
| 变为 biàn wéi | 水变为了冰。 | Shuǐ biànwéi le bīng. | The water turned into ice. |
| 职工 zhí gōng | 这家公司有一百个职工。 | Zhè jiā gōngsī yǒu yī bǎi gè zhígōng. | This company has a hundred employees. |
| 报到 bào dào | 新同学明天来报到。 | Xīn tóngxué míngtiān lái bàodào. | The new student is checking in tomorrow. |
| 美术 měi shù | 我最喜欢上美术课。 | Wǒ zuì xǐhuan shàng měishù kè. | Art is my favourite class. |
| 武术 wǔ shù | 他从小学习武术。 | Tā cóng xiǎo xuéxí wǔshù. | He's studied martial arts since he was little. |
| 短裤 duǎn kù | 天热了，我穿短裤。 | Tiān rè le, wǒ chuān duǎnkù. | It's got hot, so I'm wearing shorts. |
| 广大 guǎng dà | 这本书受到广大读者的喜欢。 | Zhè běn shū shòudào guǎngdà dúzhě de xǐhuan. | This book is popular with lots of readers. |
| 收听 shōu tīng | 我每天早上收听新闻。 | Wǒ měitiān zǎoshang shōutīng xīnwén. | I listen to the news every morning. |
| 初级 chū jí | 我在上初级中文课。 | Wǒ zài shàng chūjí Zhōngwén kè. | I'm taking a beginners' Chinese class. |
| 现代化 xiàn dài huà | 这个城市很现代化。 | Zhège chéngshì hěn xiàndàihuà. | This city is very modern. |
| 专题 zhuān tí | 今天的专题是环境。 | Jīntiān de zhuāntí shì huánjìng. | Today's topic is the environment. |
| 创业 chuàng yè | 他毕业以后自己创业。 | Tā bìyè yǐhòu zìjǐ chuàngyè. | After graduating he started his own business. |
| 本领 běn lǐng | 他的本领很大。 | Tā de běnlǐng hěn dà. | He's very capable. |
| 话剧 huà jù | 我们晚上去看话剧。 | Wǒmen wǎnshang qù kàn huàjù. | We're going to see a play tonight. |
| 分组 fēn zǔ | 老师让我们分组讨论。 | Lǎoshī ràng wǒmen fēnzǔ tǎolùn. | The teacher had us discuss in groups. |
| 年底 nián dǐ | 我年底回丹麦。 | Wǒ niándǐ huí Dānmài. | I'm going back to Denmark at the end of the year. |
| 带动 dài dòng | 他带动大家一起运动。 | Tā dàidòng dàjiā yīqǐ yùndòng. | He gets everyone exercising together. |
| 影视 yǐng shì | 她在一家影视公司工作。 | Tā zài yī jiā yǐngshì gōngsī gōngzuò. | She works at a film and TV company. |
| 国庆 Guó qìng | 国庆的时候我们去旅游。 | Guóqìng de shíhou wǒmen qù lǚyóu. | We travel over National Day. |
| 票价 piào jià | 票价是五十块。 | Piàojià shì wǔshí kuài. | The ticket costs fifty kuai. |
| 有的是 yǒu de shì | 别着急，我们有的是时间。 | Bié zháojí, wǒmen yǒudeshì shíjiān. | Don't worry, we have plenty of time. |
| 皮包 pí bāo | 她的皮包很好看。 | Tā de píbāo hěn hǎokàn. | Her handbag is lovely. |
| 连续剧 lián xù jù | 我每天晚上看连续剧。 | Wǒ měitiān wǎnshang kàn liánxùjù. | I watch a TV series every evening. |
| 图画 tú huà | 孩子画了一张图画。 | Háizi huà le yī zhāng túhuà. | The child drew a picture. |
| 白菜 bái cài | 冬天北京人常吃白菜。 | Dōngtiān Běijīng rén cháng chī báicài. | In winter people in Beijing often eat Chinese cabbage. |
| 年初 nián chū | 我年初开始学中文。 | Wǒ niánchū kāishǐ xué Zhōngwén. | I started learning Chinese at the start of the year. |
| 试题 shì tí | 这次的试题不太难。 | Zhè cì de shìtí bù tài nán. | The exam questions weren't too hard this time. |
| 积极性 jī jí xìng | 学生的积极性很高。 | Xuésheng de jījíxìng hěn gāo. | The students are very keen. |
| 人民币 rén mín bì | 这个多少人民币？ | Zhège duōshao rénmínbì? | How much is this in RMB? |
| 老头儿 lǎo tóur | 那个老头儿是我爷爷。 | Nàge lǎotóur shì wǒ yéye. | That old man is my grandpa. |
| 交费 jiāo fèi | 我们去前边交费吧。 | Wǒmen qù qiánbian jiāofèi ba. | Let's go and pay at the front. |
| 跳高 tiào gāo | 他跳高跳得很好。 | Tā tiàogāo tiào de hěn hǎo. | He's very good at the high jump. |
| 外文 wài wén | 她会三种外文。 | Tā huì sān zhǒng wàiwén. | She knows three foreign languages. |
| 预习 yù xí | 上课以前要预习。 | Shàngkè yǐqián yào yùxí. | You should prepare before class. |
| 跳远 tiào yuǎn | 我最喜欢跳远。 | Wǒ zuì xǐhuan tiàoyuǎn. | The long jump is my favourite. |
| 京剧 Jīng jù | 爷爷喜欢听京剧。 | Yéye xǐhuan tīng jīngjù. | Grandpa likes listening to Beijing opera. |
| 后年 hòu nián | 我后年大学毕业。 | Wǒ hòunián dàxué bìyè. | I graduate from university the year after next. |
| 连忙 lián máng | 他连忙说对不起。 | Tā liánmáng shuō duìbuqǐ. | He quickly said sorry. |
| 着 zháo | 我昨天晚上没睡着。 | Wǒ zuótiān wǎnshang méi shuì zháo. | I couldn't get to sleep last night. |
| 啊 ā | 啊！下雪了！ | Ā! Xià xuě le! | Oh! It's snowing! |
| 打 dá | 我买了一打鸡蛋。 | Wǒ mǎi le yī dá jīdàn. | I bought a dozen eggs. |
| 种 zhòng | 奶奶在家里种花。 | Nǎinai zài jiāli zhòng huā. | Grandma grows flowers at home. |
| 地方 dì fāng | 他在地方政府工作。 | Tā zài dìfāng zhèngfǔ gōngzuò. | He works for the local government. |
| 哪 na | 天哪，太贵了！ | Tiān na, tài guì le! | Oh my god, that's so expensive! |
| 于是 yú shì | 下雨了，于是我们回家了。 | Xià yǔ le, yúshì wǒmen huí jiā le. | It started raining, so we went home. |
| 空 kòng | 你什么时候有空？ | Nǐ shénme shíhou yǒu kòng? | When are you free? |
| 系 jì | 请系好安全带。 | Qǐng jì hǎo ānquándài. | Please fasten your seat belt. |
| 稳定 wěn dìng | 他的工作很稳定。 | Tā de gōngzuò hěn wěndìng. | His job is very stable. |
| 阶段 jiē duàn | 现在是最重要的阶段。 | Xiànzài shì zuì zhòngyào de jiēduàn. | This is the most important stage. |
| 卷 juàn | 请把试卷交给我。 | Qǐng bǎ shìjuàn jiāo gěi wǒ. | Please hand me your exam paper. |
| 检测 jiǎn cè | 医生给我检测了一下。 | Yīshēng gěi wǒ jiǎncè le yīxià. | The doctor tested me. |
| 经典 jīng diǎn | 这是一部经典电影。 | Zhè shì yī bù jīngdiǎn diànyǐng. | This is a classic film. |
| 背景 bèi jǐng | 这张照片的背景是长城。 | Zhè zhāng zhàopiàn de bèijǐng shì Chángchéng. | The Great Wall is in the background of this photo. |
| 镜头 jìng tóu | 看镜头，笑一笑！ | Kàn jìngtóu, xiào yī xiào! | Look at the camera and smile! |
| 指挥 zhǐ huī | 警察在路口指挥交通。 | Jǐngchá zài lùkǒu zhǐhuī jiāotōng. | A policeman is directing traffic at the junction. |
| 造型 zào xíng | 你的新造型很好看。 | Nǐ de xīn zàoxíng hěn hǎokàn. | Your new look is great. |
| 引 yǐn | 他把大家引到了门口。 | Tā bǎ dàjiā yǐn dào le ménkǒu. | He led everyone to the door. |
| 弱 ruò | 我的听力比较弱。 | Wǒ de tīnglì bǐjiào ruò. | My listening is quite weak. |
| 划 huà | 请把钱划到我的卡上。 | Qǐng bǎ qián huà dào wǒ de kǎ shang. | Please transfer the money to my card. |
| 激烈 jī liè | 比赛非常激烈。 | Bǐsài fēicháng jīliè. | The match was very intense. |
| 维护 wéi hù | 我们要维护自己的权利。 | Wǒmen yào wéihù zìjǐ de quánlì. | We need to stand up for our rights. |
| 对付 duì fu | 这个问题不好对付。 | Zhège wèntí bù hǎo duìfu. | This problem is hard to deal with. |
| 总之 zǒng zhī | 总之，我不同意。 | Zǒngzhī, wǒ bù tóngyì. | In short, I don't agree. |
| 稳 wěn | 他开车开得很稳。 | Tā kāichē kāi de hěn wěn. | He drives very steadily. |
| 统一 tǒng yī | 我们的意见统一了。 | Wǒmen de yìjiàn tǒngyī le. | We've come to an agreement. |
| 身材 shēn cái | 她身材很好。 | Tā shēncái hěn hǎo. | She's got a great figure. |
| 独特 dú tè | 这个城市很独特。 | Zhège chéngshì hěn dútè. | This city is unique. |
| 夫妻 fū qī | 他们是一对老夫妻。 | Tāmen shì yī duì lǎo fūqī. | They're an old married couple. |
| 特征 tè zhēng | 这种花有什么特征？ | Zhè zhǒng huā yǒu shénme tèzhēng? | What are the features of this flower? |
| 供应 gōng yìng | 这里供应早饭。 | Zhèlǐ gōngyìng zǎofàn. | Breakfast is served here. |
| 培训 péi xùn | 公司给新员工培训。 | Gōngsī gěi xīn yuángōng péixùn. | The company trains new staff. |
| 大哥 dà gē | 大哥，请问去车站怎么走？ | Dàgē, qǐngwèn qù chēzhàn zěnme zǒu? | Excuse me, how do I get to the station? |
| 技巧 jì qiǎo | 学习也要有技巧。 | Xuéxí yě yào yǒu jìqiǎo. | Studying takes technique too. |
| 转身 zhuǎn shēn | 他转身就走了。 | Tā zhuǎnshēn jiù zǒu le. | He turned round and left. |
| 投诉 tóu sù | 我要投诉这家饭馆。 | Wǒ yào tóusù zhè jiā fànguǎn. | I want to complain about this restaurant. |
| 汇报 huì bào | 我明天向经理汇报。 | Wǒ míngtiān xiàng jīnglǐ huìbào. | I'm reporting to the manager tomorrow. |
| 胖子 pàng zi | 别叫他胖子。 | Bié jiào tā pàngzi. | Don't call him fatty. |
| 含量 hán liàng | 这个饮料的糖含量很高。 | Zhège yǐnliào de táng hánliàng hěn gāo. | This drink has a high sugar content. |
| 单纯 dān chún | 她是一个很单纯的人。 | Tā shì yī gè hěn dānchún de rén. | She's a very simple, sincere person. |
| 健身 jiàn shēn | 我每天去健身。 | Wǒ měitiān qù jiànshēn. | I work out every day. |
| 待遇 dài yù | 这家公司的待遇很好。 | Zhè jiā gōngsī de dàiyù hěn hǎo. | This company pays well. |
| 胸部 xiōng bù | 我胸部有点儿疼。 | Wǒ xiōngbù yǒudiǎnr téng. | My chest hurts a bit. |
| 赞助 zàn zhù | 这次比赛有公司赞助。 | Zhè cì bǐsài yǒu gōngsī zànzhù. | This competition is sponsored by a company. |
| 玉 yù | 这块玉很漂亮。 | Zhè kuài yù hěn piàoliang. | This piece of jade is beautiful. |
| 缩小 suō xiǎo | 我们之间的差距缩小了。 | Wǒmen zhījiān de chājù suōxiǎo le. | The gap between us has narrowed. |
| 潮 cháo | 她穿得很潮。 | Tā chuān de hěn cháo. | She dresses very fashionably. |
| 著作 zhù zuò | 这位老师有很多著作。 | Zhè wèi lǎoshī yǒu hěn duō zhùzuò. | This teacher has written many books. |
| 骨头 gǔ tou | 小狗喜欢吃骨头。 | Xiǎo gǒu xǐhuan chī gǔtou. | The puppy likes eating bones. |
| 沉重 chén zhòng | 这个包很沉重。 | Zhège bāo hěn chénzhòng. | This bag is very heavy. |
| 商务 shāng wù | 他去上海参加商务会议。 | Tā qù Shànghǎi cānjiā shāngwù huìyì. | He's going to Shanghai for a business meeting. |
| 替代 tì dài | 电脑不能替代老师。 | Diànnǎo bù néng tìdài lǎoshī. | Computers can't replace teachers. |
| 安置 ān zhì | 他们安置好了新家。 | Tāmen ānzhì hǎo le xīn jiā. | They've got their new home set up. |
| 数码 shù mǎ | 我买了一个数码相机。 | Wǒ mǎi le yī gè shùmǎ xiàngjī. | I bought a digital camera. |
| 性质 xìng zhì | 这两个问题的性质不一样。 | Zhè liǎng gè wèntí de xìngzhì bù yīyàng. | These two problems are different in nature. |
| 考察 kǎo chá | 他们去南方考察。 | Tāmen qù nánfāng kǎochá. | They went south on a study visit. |
| 机遇 jī yù | 这是一个很好的机遇。 | Zhè shì yī gè hěn hǎo de jīyù. | This is a great opportunity. |
| 紧密 jǐn mì | 我们的关系很紧密。 | Wǒmen de guānxi hěn jǐnmì. | We're very close. |
| 顺序 shùn xù | 请按照顺序排队。 | Qǐng ànzhào shùnxù páiduì. | Please queue in order. |
| 语音 yǔ yīn | 我给你发一条语音。 | Wǒ gěi nǐ fā yī tiáo yǔyīn. | I'll send you a voice message. |
| 纪律 jì lǜ | 学校的纪律很严。 | Xuéxiào de jìlǜ hěn yán. | The school is very strict. |
| 记载 jì zǎi | 书上记载了这个故事。 | Shū shang jìzǎi le zhège gùshi. | The story is recorded in the book. |
| 粮食 liáng shi | 我们不能浪费粮食。 | Wǒmen bù néng làngfèi liángshi. | We mustn't waste food. |
| 趋势 qū shì | 这是一个新的趋势。 | Zhè shì yī gè xīn de qūshì. | This is a new trend. |
| 阳台 yáng tái | 妈妈在阳台上种花。 | Māma zài yángtái shang zhòng huā. | Mum grows flowers on the balcony. |
| 智力 zhì lì | 这个游戏能提高智力。 | Zhège yóuxì néng tígāo zhìlì. | This game can make you smarter. |
| 智能 zhì néng | 现在人人都有智能手机。 | Xiànzài rénrén dōu yǒu zhìnéng shǒujī. | Everyone has a smartphone now. |
| 节省 jié shěng | 坐地铁可以节省时间。 | Zuò dìtiě kěyǐ jiéshěng shíjiān. | Taking the metro saves time. |
| 宁静 níng jìng | 晚上的公园很宁静。 | Wǎnshang de gōngyuán hěn níngjìng. | The park is peaceful in the evening. |
| 以内 yǐ nèi | 请在十分钟以内回来。 | Qǐng zài shí fēnzhōng yǐnèi huílai. | Please be back within ten minutes. |
| 快递 kuài dì | 我的快递到了。 | Wǒ de kuàidì dào le. | My parcel has arrived. |
| 分布 fēn bù | 这种树分布在南方。 | Zhè zhǒng shù fēnbù zài nánfāng. | This kind of tree grows in the south. |
| 高尚 gāo shàng | 他是一个高尚的人。 | Tā shì yī gè gāoshàng de rén. | He's a man of noble character. |
| 夏季 xià jì | 夏季的北京很热。 | Xiàjì de Běijīng hěn rè. | Beijing is hot in summer. |
| 获奖 huò jiǎng | 他的电影获奖了。 | Tā de diànyǐng huòjiǎng le. | His film won a prize. |
| 种植 zhòng zhí | 这里种植了很多水果。 | Zhèlǐ zhòngzhí le hěn duō shuǐguǒ. | Lots of fruit is grown here. |
| 促使 cù shǐ | 这件事促使他努力学习。 | Zhè jiàn shì cùshǐ tā nǔlì xuéxí. | This pushed him to study hard. |
| 个体 gè tǐ | 每个人都是不同的个体。 | Měi gè rén dōu shì bùtóng de gètǐ. | Every person is a different individual. |
| 圆满 yuán mǎn | 会议圆满结束了。 | Huìyì yuánmǎn jiéshù le. | The meeting ended successfully. |
| 热心 rè xīn | 我的邻居很热心。 | Wǒ de línjū hěn rèxīn. | My neighbour is very helpful. |
| 纷纷 fēn fēn | 下课了，同学们纷纷走出教室。 | Xiàkè le, tóngxuémen fēnfēn zǒuchū jiàoshì. | Class is over and the students file out one after another. |
| 流传 liú chuán | 这个故事流传了很多年。 | Zhège gùshi liúchuán le hěn duō nián. | This story has been passed down for many years. |
| 中介 zhōng jiè | 我们通过中介找到了房子。 | Wǒmen tōngguò zhōngjiè zhǎodào le fángzi. | We found a flat through an agent. |
| 列入 liè rù | 这个地方被列入了旅游计划。 | Zhège dìfang bèi lièrù le lǚyóu jìhuà. | This place was added to the travel plan. |
| 排列 pái liè | 请把这些字排列好。 | Qǐng bǎ zhèxiē zì páiliè hǎo. | Please put these characters in order. |
| 用途 yòng tú | 这个东西有什么用途？ | Zhège dōngxi yǒu shénme yòngtú? | What is this thing used for? |
| 体检 tǐ jiǎn | 我明天去医院体检。 | Wǒ míngtiān qù yīyuàn tǐjiǎn. | I'm going for a check-up at the hospital tomorrow. |
| 新郎 xīn láng | 新郎今天很高兴。 | Xīnláng jīntiān hěn gāoxìng. | The groom is very happy today. |
| 积累 jī lěi | 学语言要慢慢积累。 | Xué yǔyán yào mànmàn jīlěi. | You build up a language bit by bit. |
| 研制 yán zhì | 他们在研制新药。 | Tāmen zài yánzhì xīn yào. | They're developing a new medicine. |
| 格外 gé wài | 今天的月亮格外圆。 | Jīntiān de yuèliang géwài yuán. | The moon is especially round tonight. |
| 动摇 dòng yáo | 他的决心没有动摇。 | Tā de juéxīn méiyǒu dòngyáo. | His determination didn't waver. |
| 大爷 dà ye | 大爷，你身体好吗？ | Dàye, nǐ shēntǐ hǎo ma? | How are you keeping? (to an older man) |
| 扩展 kuò zhǎn | 我们要扩展业务。 | Wǒmen yào kuòzhǎn yèwù. | We need to expand the business. |
| 痛快 tòng kuài | 今天玩得真痛快！ | Jīntiān wán de zhēn tòngkuai! | We had a great time today! |
| 平稳 píng wěn | 飞机飞得很平稳。 | Fēijī fēi de hěn píngwěn. | The flight was very smooth. |
| 描写 miáo xiě | 这本书描写了北京的生活。 | Zhè běn shū miáoxiě le Běijīng de shēnghuó. | This book describes life in Beijing. |
| 相片 xiàng piàn | 这是我小时候的相片。 | Zhè shì wǒ xiǎo shíhou de xiàngpiàn. | This is a photo of me as a child. |
| 大姐 dà jiě | 大姐，这个多少钱？ | Dàjiě, zhège duōshao qián? | Excuse me, how much is this? (to a woman) |
| 气球 qì qiú | 孩子手里拿着一个气球。 | Háizi shǒu li ná zhe yī gè qìqiú. | The child is holding a balloon. |
| 春季 chūn jì | 春季的天气很舒服。 | Chūnjì de tiānqì hěn shūfu. | The weather in spring is lovely. |
| 赞赏 zàn shǎng | 老板很赞赏他的工作。 | Lǎobǎn hěn zànshǎng tā de gōngzuò. | The boss really appreciates his work. |
| 发票 fā piào | 请给我开一张发票。 | Qǐng gěi wǒ kāi yī zhāng fāpiào. | Please give me a receipt. |
| 不要紧 bù yào jǐn | 不要紧，我没事。 | Bùyàojǐn, wǒ méi shì. | It doesn't matter, I'm fine. |
| 培育 péi yù | 这里培育了很多新品种。 | Zhèlǐ péiyù le hěn duō xīn pǐnzhǒng. | Many new varieties were bred here. |
| 轮椅 lún yǐ | 爷爷坐在轮椅上。 | Yéye zuò zài lúnyǐ shang. | Grandpa is sitting in a wheelchair. |
| 小吃 xiǎo chī | 北京有很多好吃的小吃。 | Běijīng yǒu hěn duō hǎochī de xiǎochī. | Beijing has lots of tasty snacks. |
| 特价 tè jià | 今天的水果是特价。 | Jīntiān de shuǐguǒ shì tèjià. | The fruit is on special offer today. |
| 爱护 ài hù | 我们要爱护环境。 | Wǒmen yào àihù huánjìng. | We should take care of the environment. |
| 优良 yōu liáng | 他的成绩很优良。 | Tā de chéngjì hěn yōuliáng. | His grades are excellent. |
| 方针 fāng zhēn | 学校的方针是快乐学习。 | Xuéxiào de fāngzhēn shì kuàilè xuéxí. | The school's guiding principle is learning with joy. |
| 操场 cāo chǎng | 学生们在操场上跑步。 | Xuéshengmen zài cāochǎng shang pǎobù. | The students are running on the sports field. |
| 上楼 shàng lóu | 我先上楼了。 | Wǒ xiān shàng lóu le. | I'm going upstairs first. |
| 陆地 lù dì | 船终于到了陆地。 | Chuán zhōngyú dào le lùdì. | The boat finally reached land. |
| 降温 jiàng wēn | 明天要降温了。 | Míngtiān yào jiàngwēn le. | It's going to get colder tomorrow. |
| 抽奖 chōu jiǎng | 我在抽奖中得了一个手机。 | Wǒ zài chōujiǎng zhōng dé le yī gè shǒujī. | I won a phone in a raffle. |
| 概括 gài kuò | 请概括一下这篇文章。 | Qǐng gàikuò yīxià zhè piān wénzhāng. | Please summarise this article. |
| 孙女 sūn nǚ | 奶奶很爱她的孙女。 | Nǎinai hěn ài tā de sūnnǚ. | Grandma loves her granddaughter very much. |
| 高价 gāo jià | 他用高价买了这张票。 | Tā yòng gāojià mǎi le zhè zhāng piào. | He paid a high price for this ticket. |
| 大妈 dà mā | 楼下的大妈很热心。 | Lóu xià de dàmā hěn rèxīn. | The auntie downstairs is very kind. |
| 随手 suí shǒu | 出门的时候请随手关灯。 | Chūmén de shíhou qǐng suíshǒu guān dēng. | Please turn off the light on your way out. |
| 转告 zhuǎn gào | 请你转告他，我明天不来了。 | Qǐng nǐ zhuǎngào tā, wǒ míngtiān bù lái le. | Please tell him I won't come tomorrow. |
| 公元 gōng yuán | 长城是公元前修建的。 | Chángchéng shì gōngyuán qián xiūjiàn de. | The Great Wall was built BC. |
| 制订 zhì dìng | 我们制订了一个学习计划。 | Wǒmen zhìdìng le yī gè xuéxí jìhuà. | We drew up a study plan. |
| 陆续 lù xù | 客人们陆续到了。 | Kèrenmen lùxù dào le. | The guests arrived one after another. |
| 率先 shuài xiān | 他率先完成了比赛。 | Tā shuàixiān wánchéng le bǐsài. | He was the first to finish the race. |
| 冰雪 bīng xuě | 哈尔滨的冰雪节很有名。 | Hā'ěrbīn de bīngxuě jié hěn yǒumíng. | Harbin's Ice and Snow Festival is famous. |
| 矿泉水 kuàng quán shuǐ | 我要一瓶矿泉水。 | Wǒ yào yī píng kuàngquánshuǐ. | I'd like a bottle of mineral water. |
| 打针 dǎ zhēn | 孩子怕打针。 | Háizi pà dǎzhēn. | The child is scared of injections. |
| 再三 zài sān | 他再三说谢谢。 | Tā zàisān shuō xièxie. | He said thank you again and again. |
| 果实 guǒ shí | 树上结满了果实。 | Shù shang jiē mǎn le guǒshí. | The tree is full of fruit. |
| 内科 nèi kē | 你应该去看内科。 | Nǐ yīnggāi qù kàn nèikē. | You should see a general physician. |
| 深厚 shēn hòu | 我们的友谊很深厚。 | Wǒmen de yǒuyì hěn shēnhòu. | Our friendship runs deep. |
| 降价 jiàng jià | 这个手机降价了。 | Zhège shǒujī jiàngjià le. | This phone has come down in price. |
| 通知书 tōng zhī shū | 我收到了大学的通知书。 | Wǒ shōudào le dàxué de tōngzhīshū. | I got my university admission letter. |
| 培训班 péi xùn bān | 我参加了一个中文培训班。 | Wǒ cānjiā le yī gè Zhōngwén péixùnbān. | I joined a Chinese training course. |
| 外汇 wài huì | 我去银行换外汇。 | Wǒ qù yínháng huàn wàihuì. | I'm going to the bank to change money. |
| 轮子 lún zi | 自行车的轮子坏了。 | Zìxíngchē de lúnzi huài le. | The bike's wheel is broken. |
| 学分 xué fēn | 这门课有三个学分。 | Zhè mén kè yǒu sān gè xuéfēn. | This course is worth three credits. |
| 摆动 bǎi dòng | 树在风中摆动。 | Shù zài fēng zhōng bǎidòng. | The trees are swaying in the wind. |
| 红包 hóng bāo | 春节的时候，孩子们会收到红包。 | Chūnjié de shíhou, háizimen huì shōudào hóngbāo. | At Spring Festival, children get red envelopes. |
| 倒车 dǎo chē | 去机场要倒车吗？ | Qù jīchǎng yào dǎochē ma? | Do I need to change buses to get to the airport? |
| 倒车 dào chē | 他慢慢地倒车。 | Tā mànmàn de dàochē. | He reversed slowly. |
| 后头 hòu tou | 他在后头等我们。 | Tā zài hòutou děng wǒmen. | He's waiting for us at the back. |
| 本科 běn kē | 她是本科生。 | Tā shì běnkēshēng. | She's an undergraduate. |
| 轮船 lún chuán | 我们坐轮船去上海。 | Wǒmen zuò lúnchuán qù Shànghǎi. | We're taking a ship to Shanghai. |
| 宽广 kuān guǎng | 这里的马路很宽广。 | Zhèlǐ de mǎlù hěn kuānguǎng. | The roads here are wide. |
| 前头 qián tou | 前头有一个超市。 | Qiántou yǒu yī gè chāoshì. | There's a supermarket up ahead. |
| 期中 qī zhōng | 下个星期是期中考试。 | Xià gè xīngqī shì qīzhōng kǎoshì. | Next week is the midterm exam. |
| 网址 wǎng zhǐ | 你知道这个网址吗？ | Nǐ zhīdào zhège wǎngzhǐ ma? | Do you know this web address? |
| 吸管 xī guǎn | 请给我一根吸管。 | Qǐng gěi wǒ yī gēn xīguǎn. | Please give me a straw. |
| 学年 xué nián | 新的学年开始了。 | Xīn de xuénián kāishǐ le. | The new school year has begun. |
| 售货员 shòu huò yuán | 售货员很热情。 | Shòuhuòyuán hěn rèqíng. | The shop assistant is very friendly. |
| 口语 kǒu yǔ | 我的口语还不太好。 | Wǒ de kǒuyǔ hái bù tài hǎo. | My spoken Chinese isn't very good yet. |
| 近代 jìn dài | 这是一本近代史的书。 | Zhè shì yī běn jìndài shǐ de shū. | This is a book about modern history. |
| 疗养 liáo yǎng | 爷爷去海边疗养了。 | Yéye qù hǎibiān liáoyǎng le. | Grandpa has gone to the seaside to recuperate. |
| 矮小 ǎi xiǎo | 他长得很矮小。 | Tā zhǎng de hěn ǎixiǎo. | He's short and slight. |
| 刷子 shuā zi | 用刷子把鞋刷干净。 | Yòng shuāzi bǎ xié shuā gānjìng. | Scrub the shoes clean with a brush. |
| 毫米 háo mǐ | 这张纸厚一毫米。 | Zhè zhāng zhǐ hòu yī háomǐ. | This sheet of paper is one millimetre thick. |
| 亚运会 Yà yùn huì | 亚运会在中国举行。 | Yàyùnhuì zài Zhōngguó jǔxíng. | The Asian Games are being held in China. |
| 高铁 gāo tiě | 坐高铁去上海很快。 | Zuò gāotiě qù Shànghǎi hěn kuài. | The high-speed train to Shanghai is quick. |
| 电动车 diàn dòng chē | 我骑电动车上班。 | Wǒ qí diàndòngchē shàngbān. | I ride an e-bike to work. |
| 毫升 háo shēng | 这瓶水有五百毫升。 | Zhè píng shuǐ yǒu wǔbǎi háoshēng. | This bottle holds five hundred millilitres. |
| 五颜六色 wǔ yán liù sè | 公园里的花五颜六色。 | Gōngyuán li de huā wǔyánliùsè. | The flowers in the park are all sorts of colours. |
| 隔开 gé kāi | 一条河把两个村子隔开了。 | Yī tiáo hé bǎ liǎng gè cūnzi gékāi le. | A river separates the two villages. |
| 模特儿 mó tèr | 她以前是一个模特儿。 | Tā yǐqián shì yī gè mótèr. | She used to be a model. |
| 抄写 chāo xiě | 请把生词抄写三遍。 | Qǐng bǎ shēngcí chāoxiě sān biàn. | Please copy out the new words three times. |
| 没法儿 méi fǎr | 他不听，我也没法儿。 | Tā bù tīng, wǒ yě méi fǎr. | He won't listen, and there's nothing I can do. |
| 纯净水 chún jìng shuǐ | 我只喝纯净水。 | Wǒ zhǐ hē chúnjìngshuǐ. | I only drink purified water. |
| 学时 xué shí | 这门课一共四十个学时。 | Zhè mén kè yīgòng sìshí gè xuéshí. | This course is forty class hours in total. |
| 名牌儿 míng páir | 他穿的都是名牌儿。 | Tā chuān de dōu shì míngpáir. | He only wears designer brands. |
| 有劲儿 yǒu jìnr | 他说话很有劲儿。 | Tā shuōhuà hěn yǒu jìnr. | He speaks with real energy. |
| 动作 dòng zuò | 他的动作很快。 | Tā de dòngzuò hěn kuài. | His movements are very quick. |
| 地点 dì diǎn | 见面的地点在哪里？ | Jiànmiàn de dìdiǎn zài nǎlǐ? | Where is the meeting place? |
| 妹 mèi | 她是我小妹。 | Tā shì wǒ xiǎo mèi. | She's my little sister. |
| 路口 lù kǒu | 到了路口你往右走。 | Dào le lùkǒu nǐ wǎng yòu zǒu. | When you get to the crossing, go right. |
| 请假 qǐng jià | 我明天想请假。 | Wǒ míngtiān xiǎng qǐngjià. | I'd like to take tomorrow off. |
| 一块儿 yī kuàir | 我们一块儿去吃饭吧。 | Wǒmen yīkuàir qù chīfàn ba. | Let's go and eat together. |
| 书包 shū bāo | 我的书包在桌子上。 | Wǒ de shūbāo zài zhuōzi shàng. | My school bag is on the table. |
| 外边 wài bian | 外边下雨了。 | Wàibian xià yǔ le. | It's raining outside. |
| 西边 xī biān | 学校在西边。 | Xuéxiào zài xībiān. | The school is on the west side. |
| 东边 dōng bian | 我家在东边。 | Wǒ jiā zài dōngbian. | My home is on the east side. |
| 女孩儿 nǚ háir | 那个女孩儿是我同学。 | Nàge nǚháir shì wǒ tóngxué. | That girl is my classmate. |
| 一下儿 yī xiàr | 你等一下儿。 | Nǐ děng yīxiàr. | Wait a moment. |
| 得 dé | 这次比赛他得第一。 | Zhè cì bǐsài tā dé dì yī. | He came first in this competition. |
| 头 tou | 这张桌子是木头的。 | Zhè zhāng zhuōzi shì mùtou de. | This table is made of wood. |
| 比如 bǐ rú | 我喜欢水果，比如苹果。 | Wǒ xǐhuan shuǐguǒ, bǐrú píngguǒ. | I like fruit, apples for example. |
| 全国 quán guó | 这个节目全国都能看。 | Zhège jiémù quánguó dōu néng kàn. | The whole country can watch this programme. |
| 级 jí | 他的汉语是几级？ | Tā de Hànyǔ shì jǐ jí? | What level is his Chinese? |
| 小组 xiǎo zǔ | 我们小组有五个人。 | Wǒmen xiǎozǔ yǒu wǔ gè rén. | There are five people in our group. |
| 角度 jiǎo dù | 从这个角度看，你说得对。 | Cóng zhège jiǎodù kàn, nǐ shuō de duì. | From this angle, you're right. |
| 练 liàn | 我每天练一个小时。 | Wǒ měitiān liàn yī gè xiǎoshí. | I practise for an hour every day. |
| 球队 qiú duì | 这个球队很有名。 | Zhège qiúduì hěn yǒumíng. | This team is very famous. |
| 组成 zǔ chéng | 这个小组由三个人组成。 | Zhège xiǎozǔ yóu sān gè rén zǔchéng. | This group is made up of three people. |
| 全体 quán tǐ | 全体同学都来了。 | Quántǐ tóngxué dōu lái le. | All the classmates have come. |
| 南方 nán fāng | 南方的冬天不太冷。 | Nánfāng de dōngtiān bù tài lěng. | Winters in the south aren't very cold. |
| 青少年 qīng shào nián | 这本书是给青少年看的。 | Zhè běn shū shì gěi qīngshàonián kàn de. | This book is for teenagers. |
| 校园 xiào yuán | 我们的校园很大。 | Wǒmen de xiàoyuán hěn dà. | Our campus is very big. |
| 西方 Xī fāng | 他很喜欢西方音乐。 | Tā hěn xǐhuan Xīfāng yīnyuè. | He really likes Western music. |
| 坏人 huài rén | 电影里的坏人很多。 | Diànyǐng lǐ de huàirén hěn duō. | There are lots of bad guys in the film. |
| 路边 lù biān | 车停在路边。 | Chē tíng zài lùbiān. | The car is parked at the roadside. |
| 常用 cháng yòng | 这是一个常用的词。 | Zhè shì yī gè chángyòng de cí. | This is a common word. |
| 行人 xíng rén | 路上的行人很多。 | Lùshang de xíngrén hěn duō. | There are lots of people walking on the road. |
| 难看 nán kàn | 这件衣服太难看了。 | Zhè jiàn yīfu tài nánkàn le. | This piece of clothing is really ugly. |
| 那会儿 nà huìr | 那会儿我还在上学。 | Nàhuìr wǒ hái zài shàngxué. | At that time I was still at school. |
| 外卖 wài mài | 今天晚上我们叫外卖吧。 | Jīntiān wǎnshang wǒmen jiào wàimài ba. | Let's order takeaway tonight. |
| 难听 nán tīng | 他说的话很难听。 | Tā shuō de huà hěn nántīng. | What he said was really unpleasant. |
| 坏处 huài chu | 少睡觉有很多坏处。 | Shǎo shuìjiào yǒu hěn duō huàichu. | Not sleeping enough does a lot of harm. |
| 千克 qiān kè | 这些苹果一共两千克。 | Zhèxiē píngguǒ yīgòng liǎng qiānkè. | These apples weigh two kilos altogether. |
| 药片 yào piàn | 这个药片很小。 | Zhège yàopiàn hěn xiǎo. | This pill is very small. |
| 留学生 liú xué shēng | 我们班有很多留学生。 | Wǒmen bān yǒu hěn duō liúxuéshēng. | There are many international students in our class. |
| 画儿 huàr | 这张画儿很好看。 | Zhè zhāng huàr hěn hǎokàn. | This picture is very nice. |
| 老王 Lǎo wáng | 老王是我们的老师。 | Lǎo Wáng shì wǒmen de lǎoshī. | Old Wang is our teacher. |
| 媒体 méi tǐ | 这件事媒体都知道了。 | Zhè jiàn shì méitǐ dōu zhīdào le. | The media all know about this. |
| 年代 nián dài | 这是八十年代的歌。 | Zhè shì bāshí niándài de gē. | This is a song from the eighties. |
| 姑娘 gū niang | 那个姑娘是我的朋友。 | Nàge gūniang shì wǒ de péngyou. | That girl is my friend. |
| 保 bǎo | 我保你没问题。 | Wǒ bǎo nǐ méi wèntí. | I guarantee you'll be fine. |
| 背 bēi | 他每天背书包上学。 | Tā měitiān bēi shūbāo shàngxué. | He carries his school bag to school every day. |
| 压 yā | 别压我的书包。 | Bié yā wǒ de shūbāo. | Don't squash my school bag. |
| 队员 duì yuán | 我们队有十个队员。 | Wǒmen duì yǒu shí gè duìyuán. | Our team has ten players. |
| 相关 xiāng guān | 我想看看相关的书。 | Wǒ xiǎng kànkan xiāngguān de shū. | I'd like to look at some related books. |
| 内心 nèi xīn | 她的内心很难过。 | Tā de nèixīn hěn nánguò. | Inside, she feels very sad. |
| 调整 tiáo zhěng | 我要调整一下时间。 | Wǒ yào tiáozhěng yīxià shíjiān. | I need to adjust the time a bit. |
| 导演 dǎo yǎn | 这个电影的导演很有名。 | Zhège diànyǐng de dǎoyǎn hěn yǒumíng. | The director of this film is very famous. |
| 形象 xíng xiàng | 他很注意自己的形象。 | Tā hěn zhùyì zìjǐ de xíngxiàng. | He pays a lot of attention to his image. |
| 商业 shāng yè | 这里是商业中心。 | Zhèlǐ shì shāngyè zhōngxīn. | This is the business centre. |
| 试验 shì yàn | 这个试验很成功。 | Zhège shìyàn hěn chénggōng. | This experiment was a success. |
| 联合 lián hé | 两个学校联合办了一个活动。 | Liǎng gè xuéxiào liánhé bàn le yī gè huódòng. | The two schools held an event together. |
| 实力 shí lì | 这个球队很有实力。 | Zhège qiúduì hěn yǒu shílì. | This team is very strong. |
| 成立 chéng lì | 我们的公司去年成立。 | Wǒmen de gōngsī qùnián chénglì. | Our company was founded last year. |
| 飞行 fēi xíng | 这次飞行要十个小时。 | Zhè cì fēixíng yào shí gè xiǎoshí. | This flight takes ten hours. |
| 分别 fēn bié | 我们分别了三年。 | Wǒmen fēnbié le sān nián. | We were apart for three years. |
| 情感 qíng gǎn | 他不太会表达情感。 | Tā bù tài huì biǎodá qínggǎn. | He isn't very good at showing his feelings. |
| 传说 chuán shuō | 这里有一个有名的传说。 | Zhèlǐ yǒu yī gè yǒumíng de chuánshuō. | There is a famous legend about this place. |
| 至今 zhì jīn | 那件事我至今还记得。 | Nà jiàn shì wǒ zhìjīn hái jìde. | I still remember that to this day. |
| 先进 xiān jìn | 这里的医院很先进。 | Zhèlǐ de yīyuàn hěn xiānjìn. | The hospitals here are very advanced. |
| 西部 xī bù | 他的家在中国西部。 | Tā de jiā zài Zhōngguó xībù. | His home is in western China. |
| 广播 guǎng bō | 我每天早上听广播。 | Wǒ měitiān zǎoshang tīng guǎngbō. | I listen to the radio every morning. |
| 自身 zì shēn | 你要先看到自身的问题。 | Nǐ yào xiān kàndào zìshēn de wèntí. | First you need to see your own problems. |
| 推进 tuī jìn | 这个工作推进得很快。 | Zhège gōngzuò tuījìn de hěn kuài. | This work is moving forward quickly. |
| 安装 ān zhuāng | 他来我家安装电脑。 | Tā lái wǒ jiā ānzhuāng diànnǎo. | He came to my place to set up the computer. |
| 传播 chuán bō | 这个消息传播得很快。 | Zhège xiāoxi chuánbō de hěn kuài. | This news spread very fast. |
| 落后 luò hòu | 他的成绩有点落后。 | Tā de chéngjì yǒudiǎn luòhòu. | His grades have fallen behind a bit. |
| 分配 fēn pèi | 老师给我们分配了工作。 | Lǎoshī gěi wǒmen fēnpèi le gōngzuò. | The teacher gave us our tasks. |
| 演唱 yǎn chàng | 她演唱了一首中国歌。 | Tā yǎnchàng le yī shǒu Zhōngguó gē. | She sang a Chinese song. |
| 电视台 diàn shì tái | 他在电视台工作。 | Tā zài diànshìtái gōngzuò. | He works at a TV station. |
| 播放 bō fàng | 电视上正在播放新闻。 | Diànshì shàng zhèngzài bōfàng xīnwén. | The news is on TV right now. |
| 其次 qí cì | 首先要努力，其次要有方法。 | Shǒuxiān yào nǔlì, qícì yào yǒu fāngfǎ. | First you must work hard, and second you need a method. |
| 收费 shōu fèi | 这个公园不收费。 | Zhège gōngyuán bù shōufèi. | This park is free. |
| 环保 huán bǎo | 骑车上班很环保。 | Qí chē shàngbān hěn huánbǎo. | Cycling to work is good for the environment. |
| 场所 chǎng suǒ | 学校是学习的场所。 | Xuéxiào shì xuéxí de chǎngsuǒ. | School is a place for learning. |
| 亲人 qīn rén | 过年的时候我想回家看亲人。 | Guònián de shíhou wǒ xiǎng huí jiā kàn qīnrén. | At New Year I want to go home and see my family. |
| 创新 chuàng xīn | 这家公司很重视创新。 | Zhè jiā gōngsī hěn zhòngshì chuàngxīn. | This company values innovation. |
| 互联网 Hù lián wǎng | 我每天都上互联网。 | Wǒ měitiān dōu shàng hùliánwǎng. | I go on the internet every day. |
| 东部 dōng bù | 上海在中国东部。 | Shànghǎi zài Zhōngguó dōngbù. | Shanghai is in eastern China. |
| 日常 rì cháng | 这些都是日常用的东西。 | Zhèxiē dōu shì rìcháng yòng de dōngxi. | These are all things for everyday use. |
| 危害 wēi hài | 抽烟危害健康。 | Chōuyān wēihài jiànkāng. | Smoking harms your health. |
| 种子 zhǒng zi | 我买了一些花的种子。 | Wǒ mǎi le yīxiē huā de zhǒngzi. | I bought some flower seeds. |
| 推动 tuī dòng | 他们推动了这个计划。 | Tāmen tuīdòng le zhège jìhuà. | They pushed this plan forward. |
| 志愿者 zhì yuàn zhě | 我周末去做志愿者。 | Wǒ zhōumò qù zuò zhìyuànzhě. | I volunteer at the weekend. |
| 普遍 pǔ biàn | 这个问题很普遍。 | Zhège wèntí hěn pǔbiàn. | This problem is very common. |
| 面积 miàn jī | 这个房间的面积不大。 | Zhège fángjiān de miànjī bù dà. | This room isn't very big. |
| 前后 qián hòu | 我八点前后到。 | Wǒ bā diǎn qiánhòu dào. | I'll arrive around eight. |
| 学费 xué fèi | 这个大学的学费很贵。 | Zhège dàxué de xuéfèi hěn guì. | This university's fees are very expensive. |
| 否定 fǒu dìng | 他否定了我的想法。 | Tā fǒudìng le wǒ de xiǎngfǎ. | He rejected my idea. |
| 主张 zhǔ zhāng | 我主张早点出发。 | Wǒ zhǔzhāng zǎo diǎn chūfā. | I'm in favour of leaving a bit earlier. |
| 性别 xìng bié | 请写上你的性别。 | Qǐng xiě shàng nǐ de xìngbié. | Please write down your gender. |
| 近期 jìn qī | 我近期很忙。 | Wǒ jìnqī hěn máng. | I'm very busy at the moment. |
| 自主 zì zhǔ | 这件事你可以自主决定。 | Zhè jiàn shì nǐ kěyǐ zìzhǔ juédìng. | You can decide this for yourself. |
| 解开 jiě kāi | 他解开了这个问题。 | Tā jiěkāi le zhège wèntí. | He solved this problem. |
| 定期 dìng qī | 我定期去看医生。 | Wǒ dìngqī qù kàn yīshēng. | I see the doctor regularly. |
| 老百姓 lǎo bǎi xìng | 老百姓都很关心这件事。 | Lǎobǎixìng dōu hěn guānxīn zhè jiàn shì. | Ordinary people all care about this. |
| 就业 jiù yè | 现在就业不太容易。 | Xiànzài jiùyè bù tài róngyì. | Finding a job isn't easy these days. |
| 衬衣 chèn yī | 他穿了一件白衬衣。 | Tā chuān le yī jiàn bái chènyī. | He's wearing a white shirt. |
| 工夫 gōng fu | 我没工夫跟你说话。 | Wǒ méi gōngfu gēn nǐ shuōhuà. | I don't have time to talk to you. |
| 初一 chū yī | 初一那天我们去看爷爷。 | Chūyī nà tiān wǒmen qù kàn yéye. | On the first day of the month we visit Grandpa. |
| 银牌 yín pái | 她拿了一块银牌。 | Tā ná le yī kuài yínpái. | She won a silver medal. |
| 划船 huá chuán | 周末我们去公园划船。 | Zhōumò wǒmen qù gōngyuán huáchuán. | At the weekend we go rowing in the park. |
| 凉水 liáng shuǐ | 天冷了，别喝凉水。 | Tiān lěng le, bié hē liángshuǐ. | It's got cold, don't drink cold water. |
| 好 hào | 她好打听别人的事。 | Tā hào dǎting biérén de shì. | She likes to pry into other people's business. |
| 资料 zī liào | 我在网上找了一些资料。 | Wǒ zài wǎngshàng zhǎo le yīxiē zīliào. | I found some material online. |
| 心理 xīn lǐ | 他的心理压力很大。 | Tā de xīnlǐ yālì hěn dà. | He's under a lot of mental pressure. |
| 机构 jī gòu | 这是一个教育机构。 | Zhè shì yī gè jiàoyù jīgòu. | This is an educational institution. |
| 角色 jué sè | 她在电影里演一个老师的角色。 | Tā zài diànyǐng lǐ yǎn yī gè lǎoshī de juésè. | She plays a teacher in the film. |
| 即将 jí jiāng | 比赛即将开始。 | Bǐsài jíjiāng kāishǐ. | The match is about to start. |
| 系列 xì liè | 我很喜欢这个系列的书。 | Wǒ hěn xǐhuan zhège xìliè de shū. | I really like this series of books. |
| 挑 tiǎo | 你不要挑事。 | Nǐ bùyào tiǎo shì. | Don't stir up trouble. |
| 苦 kǔ | 这个药很苦。 | Zhège yào hěn kǔ. | This medicine is very bitter. |
| 来源 lái yuán | 这条消息的来源是哪里？ | Zhè tiáo xiāoxi de láiyuán shì nǎlǐ? | Where does this news come from? |
| 如今 rú jīn | 如今很多人用手机买东西。 | Rújīn hěn duō rén yòng shǒujī mǎi dōngxi. | Nowadays many people shop on their phones. |
| 结构 jié gòu | 这个句子的结构很简单。 | Zhège jùzi de jiégòu hěn jiǎndān. | The structure of this sentence is very simple. |
| 设置 shè zhì | 你可以在手机上设置时间。 | Nǐ kěyǐ zài shǒujī shàng shèzhì shíjiān. | You can set the time on your phone. |
| 地面 dì miàn | 地面很干净。 | Dìmiàn hěn gānjìng. | The floor is very clean. |
| 运用 yùn yòng | 学了新词要多运用。 | Xué le xīn cí yào duō yùnyòng. | When you learn new words, use them a lot. |
| 反而 fǎn ér | 吃了药，他反而更不舒服了。 | Chī le yào, tā fǎn'ér gèng bù shūfu le. | After taking the medicine, he felt even worse instead. |
| 引导 yǐn dǎo | 老师引导学生自己思考。 | Lǎoshī yǐndǎo xuésheng zìjǐ sīkǎo. | The teacher guides the students to think for themselves. |
| 规模 guī mó | 这个公司的规模不大。 | Zhège gōngsī de guīmó bù dà. | This company isn't very big. |
| 吸收 xī shōu | 他很快吸收了新知识。 | Tā hěn kuài xīshōu le xīn zhīshi. | He quickly took in the new knowledge. |
| 维修 wéi xiū | 我的车在维修。 | Wǒ de chē zài wéixiū. | My car is being repaired. |
| 无限 wú xiàn | 我对未来有无限的希望。 | Wǒ duì wèilái yǒu wúxiàn de xīwàng. | I have endless hope for the future. |
| 事先 shì xiān | 你应该事先告诉我。 | Nǐ yīnggāi shìxiān gàosu wǒ. | You should have told me beforehand. |
| 器官 qì guān | 心是一个重要的器官。 | Xīn shì yī gè zhòngyào de qìguān. | The heart is an important organ. |
| 小型 xiǎo xíng | 我们开了一个小型会议。 | Wǒmen kāi le yī gè xiǎoxíng huìyì. | We held a small meeting. |
| 遗产 yí chǎn | 长城是世界文化遗产。 | Chángchéng shì shìjiè wénhuà yíchǎn. | The Great Wall is a world cultural heritage site. |
| 对比 duì bǐ | 你把这两张照片对比一下。 | Nǐ bǎ zhè liǎng zhāng zhàopiàn duìbǐ yīxià. | Compare these two photos. |
| 含有 hán yǒu | 这种饮料含有很多糖。 | Zhè zhǒng yǐnliào hányǒu hěn duō táng. | This drink contains a lot of sugar. |
| 复制 fù zhì | 你可以复制这个文件。 | Nǐ kěyǐ fùzhì zhège wénjiàn. | You can copy this file. |
| 消化 xiāo huà | 吃得太快不好消化。 | Chī de tài kuài bù hǎo xiāohuà. | Eating too fast is bad for digestion. |
| 大多 dà duō | 我的朋友大多是学生。 | Wǒ de péngyou dàduō shì xuésheng. | Most of my friends are students. |
| 男士 nán shì | 这家店卖男士衣服。 | Zhè jiā diàn mài nánshì yīfu. | This shop sells men's clothes. |
| 市区 shì qū | 我住在市区。 | Wǒ zhù zài shìqū. | I live in the city centre. |
| 封闭 fēng bì | 这条路封闭了。 | Zhè tiáo lù fēngbì le. | This road is closed. |
| 遗传 yí chuán | 他的高个子是遗传的。 | Tā de gāo gèzi shì yíchuán de. | He gets his height from his parents. |
| 燃料 rán liào | 汽车需要燃料。 | Qìchē xūyào ránliào. | Cars need fuel. |
| 电源 diàn yuán | 走的时候请关上电源。 | Zǒu de shíhou qǐng guān shàng diànyuán. | Please turn off the power when you leave. |
| 神话 shén huà | 我小时候很喜欢听神话故事。 | Wǒ xiǎoshíhou hěn xǐhuan tīng shénhuà gùshi. | As a child I loved hearing myths. |
| 图案 tú àn | 这件衣服上的图案很好看。 | Zhè jiàn yīfu shàng de tú'àn hěn hǎokàn. | The pattern on this piece of clothing is very nice. |
| 得意 dé yì | 他考了第一，很得意。 | Tā kǎo le dì yī, hěn déyì. | He came first in the exam and is very pleased with himself. |
| 毕业生 bì yè shēng | 今年的毕业生很多。 | Jīnnián de bìyèshēng hěn duō. | There are a lot of graduates this year. |
| 潮流 cháo liú | 年轻人喜欢跟着潮流走。 | Niánqīngrén xǐhuan gēn zhe cháoliú zǒu. | Young people like to follow trends. |
| 学术 xué shù | 他在写一篇学术文章。 | Tā zài xiě yī piān xuéshù wénzhāng. | He's writing an academic article. |
| 抄 chāo | 请把这些词抄在本子上。 | Qǐng bǎ zhèxiē cí chāo zài běnzi shàng. | Please copy these words into your notebook. |
| 手工 shǒu gōng | 这个包是手工做的。 | Zhège bāo shì shǒugōng zuò de. | This bag is handmade. |
| 登录 dēng lù | 请先登录再买东西。 | Qǐng xiān dēnglù zài mǎi dōngxi. | Please log in first, then shop. |
| 符号 fú hào | 这个符号是什么意思？ | Zhège fúhào shì shénme yìsi? | What does this symbol mean? |
| 赏 shǎng | 我们晚上一起去赏月吧。 | Wǒmen wǎnshang yīqǐ qù shǎng yuè ba. | Let's go and admire the moon together tonight. |
| 宝石 bǎo shí | 这块宝石很贵。 | Zhè kuài bǎoshí hěn guì. | This gem is very expensive. |
| 列为 liè wéi | 这个地方被列为世界遗产。 | Zhège dìfang bèi lièwéi shìjiè yíchǎn. | This place has been listed as a world heritage site. |
| 缩短 suō duǎn | 新的路缩短了上班的时间。 | Xīn de lù suōduǎn le shàngbān de shíjiān. | The new road has shortened the commute. |
| 熟练 shú liàn | 他开车很熟练。 | Tā kāichē hěn shúliàn. | He's a very skilled driver. |
| 词汇 cí huì | 我的汉语词汇还不多。 | Wǒ de Hànyǔ cíhuì hái bù duō. | My Chinese vocabulary is still small. |
| 一再 yī zài | 他一再说对不起。 | Tā yīzài shuō duìbuqǐ. | He kept saying sorry. |
| 点名 diǎn míng | 上课的时候老师点名。 | Shàngkè de shíhou lǎoshī diǎnmíng. | The teacher takes the register at the start of class. |
| 潮湿 cháo shī | 这里的天气很潮湿。 | Zhèlǐ de tiānqì hěn cháoshī. | The weather here is very humid. |
| 坚固 jiān gù | 这座桥很坚固。 | Zhè zuò qiáo hěn jiāngù. | This bridge is very solid. |
| 套餐 tào cān | 我要一个午饭套餐。 | Wǒ yào yī gè wǔfàn tàocān. | I'd like a lunch set meal. |
| 单调 dān diào | 这里的生活有点单调。 | Zhèlǐ de shēnghuó yǒudiǎn dāndiào. | Life here is a bit monotonous. |
| 诚信 chéng xìn | 我们要讲诚信。 | Wǒmen yào jiǎng chéngxìn. | We must be honest. |
| 开水 kāi shuǐ | 小心，这是开水。 | Xiǎoxīn, zhè shì kāishuǐ. | Careful, this is boiling water. |
| 填空 tián kòng | 请用这些词填空。 | Qǐng yòng zhèxiē cí tiánkòng. | Please fill in the blanks with these words. |
