import type { LegalText } from "./types";

// Written from docs/privacy.md: change both together when a service is added.
export const privacy: LegalText = {
  updated: "2026-10-25",
  en: {
    title: "Privacy policy",
    description: "What Sekka keeps about you, who else receives it, and how to download or delete it.",
    intro:
      "Sekka helps you keep track of your job applications. This policy explains what data we keep, why, who else receives it, and the choices you have. It follows Egypt's Personal Data Protection Law (No. 151 of 2020).",
    sections: [
      {
        id: "collect",
        title: "What we keep",
        body: [
          {
            list: [
              "Your account: your email, your password (stored only as a secure hash, never readable), or your Google account ID if you sign in with Google; your language, time zone and email preferences.",
              "What you enter: companies, roles, job links, statuses, dates, notes, interviews and follow-ups.",
              "Technical data: requests to our servers and error reports, with email addresses removed, and your IP address, which we use to stop abuse such as password guessing.",
            ],
          },
        ],
      },
      {
        id: "use",
        title: "How we use it",
        body: [
          {
            list: [
              "To run your account and show you your applications.",
              "To send the emails you need or asked for: confirming your email, resetting your password, and the morning reminder about follow-ups. You can stop reminders from the link in any reminder or in settings.",
              "To count how Sekka is used (sign-ups, applications added, active users) under a random ID. These counts never include your email, your name or anything you type.",
              "To find and fix errors.",
            ],
          },
          "We don't sell your data, we don't show ads, and we don't share what you write with employers.",
        ],
      },
      {
        id: "services",
        title: "Who else receives it",
        body: [
          "We use these services to run Sekka. Each one handles data only to provide its service to us, and some of them are outside Egypt:",
          {
            list: [
              "Neon: the database where your account and applications are stored.",
              "Render and Vercel: the servers that run Sekka and its website.",
              "Resend: sends our emails, so it receives your address and the email.",
              "Google: only if you choose Sign in with Google.",
              "PostHog (EU): the usage counts described above, without your email or what you type.",
              "Sentry: error reports, with personal data removed before they're sent.",
            ],
          },
          "We may also share data if the law requires it.",
        ],
      },
      {
        id: "cookies",
        title: "Cookies",
        body: [
          "Sekka only keeps what it needs in your browser: cookies that keep you logged in, and your choices, such as your language, light or dark theme, and whether you've closed the getting-started guide. There are no advertising or tracking cookies, which is why there's no cookie banner.",
        ],
      },
      {
        id: "extension",
        title: "The browser extension",
        body: [
          "The Sekka extension reads the page you're on only when you click it, and sends the company, role and link to your account only when you click Save. It can't see your other tabs or your browsing history, and it keeps nothing itself.",
        ],
      },
      {
        id: "rights",
        title: "Your choices",
        body: [
          {
            list: [
              "Download everything we keep about you from Settings › Your data.",
              "Change or delete any application at any time.",
              "Stop reminder emails from the email itself or from settings.",
              "Delete your account from Settings. This deletes your account and everything in it right away.",
            ],
          },
        ],
      },
      {
        id: "retention",
        title: "How long we keep it",
        body: [
          "We keep your data while your account exists. When you delete your account, it's deleted at once from the database. Database backups and our providers' logs keep copies for a short time after that (usually no more than 30 days) and then delete them.",
        ],
      },
      {
        id: "security",
        title: "Security",
        body: [
          "Connections are encrypted (HTTPS), passwords are stored as secure hashes, login sessions live in secure cookies, and repeated login attempts are slowed down. No system is perfectly secure, so if something goes wrong we'll tell affected users and the authorities as the law requires.",
        ],
      },
      {
        id: "age",
        title: "Age",
        body: ["Sekka is for people aged 16 or older."],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        body: [
          "When this policy changes, we update the date at the top. If the change is important, we'll email you before it applies.",
        ],
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    description: "إيه اللي سكة بتحتفظ بيه عنك، مين تاني بيوصله، وإزاي تنزّله أو تمسحه.",
    intro:
      "سكة بتساعدك تتابع تقديماتك على الشغل. السياسة دي بتشرح إيه البيانات اللي بنحتفظ بيها، وليه، ومين تاني بيوصلها، والاختيارات اللي في إيدك. وهي ماشية مع قانون حماية البيانات الشخصية المصري (رقم 151 لسنة 2020).",
    sections: [
      {
        id: "collect",
        title: "إيه اللي بنحتفظ بيه",
        body: [
          {
            list: [
              "حسابك: الإيميل، وكلمة السر (بتتخزن متشفّرة بطريقة آمنة ومحدش يقدر يقراها)، أو رقم حساب جوجل لو بتدخل بجوجل؛ واللغة والمنطقة الزمنية واختياراتك للإيميلات.",
              "اللي بتكتبه: الشركات، والوظايف، ولينكات الوظايف، والمراحل، والتواريخ، والملاحظات، والإنترفيوهات، والمتابعات.",
              "بيانات تقنية: الطلبات اللي بتوصل سيرفراتنا وتقارير الأخطاء من غير الإيميلات، وعنوان الـ IP بتاعك اللي بنستخدمه عشان نوقف أي إساءة زي تخمين كلمات السر.",
            ],
          },
        ],
      },
      {
        id: "use",
        title: "بنستخدمها في إيه",
        body: [
          {
            list: [
              "عشان نشغّل حسابك ونعرضلك تقديماتك.",
              "عشان نبعتلك الإيميلات اللي محتاجها أو طلبتها: تأكيد الإيميل، وتغيير كلمة السر، وتذكير الصبح بالمتابعات. تقدر توقف التذكيرات من اللينك اللي في أي تذكير أو من الإعدادات.",
              "عشان نعدّ استخدام سكة (التسجيلات، والتقديمات الجديدة، والمستخدمين النشطين) برقم عشوائي. الأرقام دي عمرها ما بتحتوي على إيميلك أو اسمك أو أي حاجة بتكتبها.",
              "عشان نلاقي الأخطاء ونصلحها.",
            ],
          },
          "إحنا مش بنبيع بياناتك، ومش بنعرض إعلانات، ومش بنشارك اللي بتكتبه مع أصحاب الشغل.",
        ],
      },
      {
        id: "services",
        title: "مين تاني بيوصله",
        body: [
          "بنستخدم الخدمات دي عشان نشغّل سكة. كل واحدة فيهم بتتعامل مع البيانات بس عشان تقدّملنا خدمتها، وبعضهم برّه مصر:",
          {
            list: [
              "Neon: قاعدة البيانات اللي متخزن فيها حسابك وتقديماتك.",
              "Render وVercel: السيرفرات اللي بتشغّل سكة وموقعها.",
              "Resend: بتبعت إيميلاتنا، فبيوصلها عنوانك والإيميل.",
              "جوجل: بس لو اخترت الدخول بجوجل.",
              "PostHog (أوروبا): أرقام الاستخدام اللي فوق، من غير إيميلك أو اللي بتكتبه.",
              "Sentry: تقارير الأخطاء، بعد ما البيانات الشخصية تتشال منها قبل ما تتبعت.",
            ],
          },
          "وممكن نشارك بيانات لو القانون طلب كده.",
        ],
      },
      {
        id: "cookies",
        title: "الكوكيز",
        body: [
          "سكة بتحفظ في المتصفح بتاعك بس اللي محتاجاه: كوكيز عشان تفضل داخل حسابك، واختياراتك زي اللغة، والشكل الفاتح أو الغامق، ولو قفلت دليل البداية. مفيش كوكيز إعلانات أو تتبّع، وعشان كده مفيش رسالة كوكيز.",
        ],
      },
      {
        id: "extension",
        title: "إضافة المتصفح",
        body: [
          "إضافة سكة بتقرا الصفحة اللي إنت فيها بس لما تدوس عليها، وبتبعت الشركة والوظيفة واللينك لحسابك بس لما تدوس حفظ. مبتشوفش التابات التانية ولا تاريخ التصفح، ومبتحتفظش بأي حاجة عندها.",
        ],
      },
      {
        id: "rights",
        title: "اختياراتك",
        body: [
          {
            list: [
              "نزّل كل اللي بنحتفظ بيه عنك من الإعدادات › بياناتك.",
              "عدّل أو امسح أي تقديم في أي وقت.",
              "وقّف إيميلات التذكير من الإيميل نفسه أو من الإعدادات.",
              "امسح حسابك من الإعدادات. ده بيمسح حسابك وكل اللي فيه على طول.",
            ],
          },
        ],
      },
      {
        id: "retention",
        title: "بنحتفظ بيها لحد إمتى",
        body: [
          "بنحتفظ ببياناتك طول ما حسابك موجود. لما تمسح حسابك، بيتمسح من قاعدة البيانات على طول. النسخ الاحتياطية وسجلات الخدمات اللي بنستخدمها بتفضل فيها نسخة لفترة قصيرة بعدها (غالبًا مش أكتر من 30 يوم) وبعدين بتتمسح.",
        ],
      },
      {
        id: "security",
        title: "الأمان",
        body: [
          "الاتصال متشفّر (HTTPS)، وكلمات السر متخزنة متشفّرة بطريقة آمنة، وجلسات الدخول في كوكيز آمنة، ومحاولات الدخول الكتير ورا بعض بتتبطّأ. مفيش نظام آمن مية في المية، فلو حصلت مشكلة هنبلّغ المستخدمين اللي اتأثروا والجهات المختصة زي ما القانون بيطلب.",
        ],
      },
      {
        id: "age",
        title: "السن",
        body: ["سكة للي عندهم 16 سنة أو أكبر."],
      },
      {
        id: "changes",
        title: "التغييرات في السياسة دي",
        body: [
          "لما السياسة دي تتغير، بنحدّث التاريخ اللي فوق. ولو التغيير مهم، هنبعتلك إيميل قبل ما يبدأ.",
        ],
      },
    ],
  },
};
