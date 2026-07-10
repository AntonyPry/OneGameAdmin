# Smartshell Query Operations

## achievements
- returns: [Achievement]!
- args: user_id: Int
## activeWorkShift
- returns: WorkShift
- args: none
## additionalLicensePrice
- returns: LicensePrice!
- args: input: AdditionalLicensePriceInput!
## applicationsReport
- returns: UnifiedReport!
- args: input: ApplicationsReportInput!
## bonusDetailedSummaryReport
- returns: UnifiedReport!
- args: input: ReportInput!
## bonusDetailedTimeSeriesReport
- returns: UnifiedReport!
- args: input: BonusDetailedTimeSeriesInput!
## bonusHistoryReport
- returns: UnifiedReportPaginated!
- args: input: BonusHistoryReportInput!
## bonusReport
- returns: UnifiedReport!
- args: input: BonusReport!
## boughtTariffsReport
- returns: UnifiedReport!
- args: input: BoughtTariffsReport!
## canFinishWorkShift
- returns: Boolean!
- args: confirm_pass: String!
## canStartWorkShift
- returns: Boolean!
- args: none
## canUnpauseClientSession
- returns: Boolean!
- args: id: Int!, host_id: Int!
## canUseDebt
- returns: Boolean!
- args: none
## cashBoxLicenseToken
- returns: String!
- args: none
## categories
- returns: [Category]!
- args: input: CategoriesInput
## category
- returns: Category!
- args: id: Int!
## clientBookingCheckPenalty
- returns: ClientBookingPenaltyData!
- args: id: Int!, companyId: Int
## clientBookings
- returns: [ClientBooking]!
- args: status: BookingClientStatus
## clientEmailExists
- returns: Boolean!
- args: email: String!
## clientHost
- returns: ClientHost!
- args: qr: String!
## clientHostGroups
- returns: [ClientHostGroup]!
- args: companyId: Int!
## clientHosts
- returns: [ClientHost]!
- args: company_id: Int!, host_group_id: Int!, tariff_id: Int!, from: DateTime!
## clientMe
- returns: User
- args: none
## clientPhoneExists
- returns: Boolean!
- args: phone: String!
## clients
- returns: UserPaginated!
- args: input: ClientsInput, page: Int, first: Int
- description: @orderBy(column: "id", direction: DESC)
## clientSession
- returns: ClientSession!
- args: id: Int!
## clientsPaymentReport
- returns: ClientsPaymentReportPaginated!
- args: input: ClientsPaymentReportInput!, page: Int, first: Int
## clientTariffGrid
- returns: [ClientTariffGridItem]!
- args: input: ClientTariffGridInput!
## club
- returns: Club!
- args: id: Int!
## clubComments
- returns: ClubCommentPaginated!
- args: input: ClubCommentSearchInput, page: Int, first: Int
## clubLoadByDayOfWeekReport
- returns: UnifiedReport!
- args: input: ReportInput!
## clubOrganization
- returns: Organization!
- args: id: Int!
## clubs
- returns: [Club]!
- args: none
## clubsOnMap
- returns: [ClientClubOnMap]!
- args: q: String, city: String
## combo
- returns: Combo!
- args: id: Int!
## comboList
- returns: [ComboListItem]!
- args: input: ComboListInput
## combos
- returns: ComboPaginated!
- args: input: SearchComboInput, page: Int, first: Int
## comments
- returns: CommentPaginated!
- args: input: CommentSearchInput!, page: Int, first: Int
## companyNewsArticle
- returns: CompanyNewsArticle
- args: id: ID!
## companyNewsList
- returns: CompanyNewsList!
- args: input: CompanyNewsListInput, page: Int, first: Int
## companyPermissions
- returns: CompanyPermissionsData!
- args: none
## contractors
- returns: [Contractor]!
- args: none
## currencies
- returns: [Currency]!
- args: none
## currency
- returns: Currency!
- args: alias: String
## currentClub
- returns: Club!
- args: none
## currentHost
- returns: Host!
- args: none
## depositCashback
- returns: DepositCashback!
- args: id: Int!
## depositCashbacks
- returns: [DepositCashback]!
- args: none
## depositTransferReport
- returns: DepositTransferReport
- args: input: DepositTransferReportInput!, page: Int, first: Int
## depositTransferSummaryReport
- returns: UnifiedReport!
- args: input: ReportInput!
## discount
- returns: Discount!
- args: id: Int!
- description: soft_exist:discounts,id
## discounts
- returns: DiscountPaginated!
- args: page: Int, first: Int
## emailExists
- returns: Boolean!
- args: input: EmailExistsInput!
## eventList
- returns: EventListPaginated!
- args: input: EventsInput, page: Int, first: Int
## exportGoods
- returns: String!
- args: input: GoodsInput
## exportOverviewReport
- returns: String!
- args: input: OverviewExportInput!
## exportSales
- returns: String!
- args: input: SalesExportInput!
## exportUsers
- returns: String!
- args: none
## featureFlags
- returns: FeatureFlags!
- args: none
## finishedWorkShifts
- returns: [WorkShift]!
- args: input: FinishedWorkShiftInput
## freeHosts
- returns: [Host]!
- args: host_id: Int
## gameAccount
- returns: GameAccount!
- args: id: Int!
- description: exists:game_accounts,id
## gameAccountGroup
- returns: GameAccountGroup!
- args: id: Int!
- description: exists:game_account_groups,id
## gameAccountGroups
- returns: [GameAccountGroup]!
- args: none
- description: @all @orderBy(column: "id", direction: DESC)
## gameAccounts
- returns: [GameAccount]!
- args: none
- description: @orderBy(column: "id", direction: DESC)
## getActiveClientList
- returns: [ActiveClient]!
- args: input: GetActiveClientListInput!, first: Int
## getAgeRatings
- returns: [AgeRating]
- args: none
## getAvailableDiscounts
- returns: [Discount]!
- args: none
## getBeneficiaries
- returns: [Beneficiary]!
- args: none
## getBeneficiaryBankDetails
- returns: BeneficiaryBankDetails
- args: beneficiary_id: String!
## getBeneficiaryDeal
- returns: BeneficiaryDeal!
- args: id: String!
## getBeneficiaryMovementsOfFunds
- returns: MovementOfFundsPaginated!
- args: input: GetBeneficiaryMovementsOfFunds!, page: Int, first: Int
- deprecated: use listBeneficiaryMovementsOfFunds
## getBeneficiaryMovementsOfFundsCsv
- returns: String!
- args: input: GetBeneficiaryMovementsOfFundsReport!
## getBonusHistory
- returns: BonusHistory!
- args: uuid: String!, page: Int, first: Int
## getBooking
- returns: Booking!
- args: id: Int!
## getBookings
- returns: BookingPaginated!
- args: hostIds: [Int]!, status: String, from: DateTime, to: DateTime, page: Int, first: Int
## getClientDepositAccounts
- returns: [DepositAccount]!
- args: company_id: Int
## getClientDepositTransfers
- returns: DepositTransferHistory!
- args: uuid: String!, page: Int, first: Int
## getClubOptions
- returns: [ClubOption]!
- args: none
## getCompanyOwner
- returns: Owner!
- args: company_id: Int!
## getCounterpartyDataByInn
- returns: CounterpartyData
- args: inn: String!
## getCurrentBeneficiary
- returns: Beneficiary
- args: club_id: Int
## getCurrentTariff
- returns: CurrentTariff!
- args: input: GetCurrentTariff!
## getDepositHistory
- returns: PaymentHistory!
- args: user_id: Int!
## getDetailedWorkShiftMoneyData
- returns: DetailedWorkShiftMoneyData
- args: id: Int
## getGoodCategoryAgeRatings
- returns: [AgeRating]!
- args: none
## getNewsFeed
- returns: NewsFeed!
- args: company_id: Int, page: Int, first: Int
## getOrganizationOwners
- returns: [Owner]!
- args: none
## getOrganizationPaymentCard
- returns: OrganizationPaymentCard!
- args: id: Int!
## getOrganizationPaymentCards
- returns: [OrganizationPaymentCard]!
- args: none
## getPaymentsByClientId
- returns: PaymentHistory!
- args: uuid: String!, page: Int, first: Int
## getSumForWithdrawToCheckingAccount
- returns: BeneficiaryBalance!
- args: beneficiary_id: String!
## getTelegramChannels
- returns: [TelegramChannel]!
- args: token: String!
## getUpcomingAutoPaymentData
- returns: UpcomingAutoPaymentData
- args: id: Int!
## getWorkShiftPaymentOverviewData
- returns: WorkShiftPaymentOverviewData
- args: id: Int
## good
- returns: Good!
- args: id: Int!
- description: "soft_exist:goods,id
## goodHistory
- returns: GoodHistory!
- args: input: GoodHistoryInput!
## goods
- returns: [Good]!
- args: input: GoodsInput
## host
- returns: Host!
- args: id: Int!
## hostAccessToken
- returns: String
- args: input: HostAccessTokenInput!
## hostCommandTemplates
- returns: [HostCommandTemplate]!
- args: none
## hostGroup
- returns: HostGroup!
- args: id: Int!
- description: exists:host_groups,id
## hostGroups
- returns: [HostGroup]!
- args: none
## hostGroupsOverview
- returns: [HostGroupOverview]!
- args: none
## hostGroupTitles
- returns: [HostGroupTitle]!
- args: none
## hosts
- returns: [Host]!
- args: none
## hostsByIds
- returns: [Host]!
- args: ids: [Int]!
## hostsOccupationReport
- returns: UnifiedReport!
- args: input: HostsOccupationReport!
## hostsOverview
- returns: [HostOverview]!
- args: none
## hostTokenByPIN
- returns: String!
- args: pin: String!
## hostType
- returns: HostType!
- args: id: Int!
- description: exists:host_types,id
- deprecated: No longer supported
## hostTypes
- returns: [HostType]!
- args: none
- deprecated: No longer supported
## income
- returns: String!
- args: none
## leaderboard
- returns: [LeaderboardUser]!
- args: companyId: Int!, from: DateTime!, to: DateTime!
## leadSourceReport
- returns: UnifiedReport!
- args: input: ReportInput!
## licenseModule
- returns: LicenseTariffModule!
- args: id: Int!
## licenseModuleCategory
- returns: LicenseTariffCategory!
- args: id: Int!
## licensePayment
- returns: LicensePaymentData!
- args: id: Int!
## licensePayments
- returns: [LicensePaymentData]!
- args: company_id: Int!
## licensePrice
- returns: LicensePrice!
- args: input: LicensePriceInput!
## licenseTariff
- returns: LicenseTariff!
- args: id: Int!
## licenseTariffGrid
- returns: LicenseTariffGrid!
- args: id: Int
## licenseTariffs
- returns: [LicenseTariff]!
- args: none
## listBeneficiaryMovementsOfFunds
- returns: ListMovementOfFundsPaginated!
- args: input: ListBeneficiaryMovementsOfFunds!, page: Int, first: Int
## loginExists
- returns: Boolean!
- args: input: LoginExistsInput!
## magicPeriods
- returns: Boolean
- args: none
## magicSuperInit
- returns: Boolean
- args: none
## me
- returns: Me
- args: none
## mobileEvents
- returns: EventPaginated!
- args: input: MobileEventsInput, page: Int, first: Int
## myClub
- returns: ClientClub!
- args: id: Int!
## myClubs
- returns: [ClientClub]!
- args: none
## myLastVisitedClub
- returns: ClientClub!
- args: none
## network
- returns: Network
- args: none
## news
- returns: News!
- args: page: Int, first: Int
## nicknameExists
- returns: Boolean!
- args: nickname: String!
## now
- returns: DateTime
- args: none
## organizationClubs
- returns: [Club]!
- args: id: Int!
## organizationMe
- returns: Organization
- args: none
## overviewReport
- returns: OverviewReport!
- args: input: ReportInput!
## pausableClientSessions
- returns: [PausableClientSession]!
- args: client_id: String
## paymentTransaction
- returns: PaymentTransaction!
- args: id: String!
## paymentTransactions
- returns: PaymentTransactionPaginated!
- args: company_id: Int, page: Int, first: Int
## permissions
- returns: [Permission]!
- args: none
## phoneExists
- returns: Boolean!
- args: input: PhoneExistsInput!
## promoCode
- returns: PromoCode!
- args: id: Int!
- description: soft_exist:promo_codes,id
## promoCodes
- returns: PromoCodePaginated!
- args: page: Int, first: Int
## publicKey
- returns: String!
- args: none
## regions
- returns: [Region]
- args: none
## roles
- returns: [Role]!
- args: none
## salesReport
- returns: UnifiedReport!
- args: input: PaymentsReport!
## searchByEan
- returns: EanEntity
- args: ean: String!
## searchClients
- returns: UserPaginated!
- args: input: ClientsInput, page: Int, first: Int
## searchClubs
- returns: [ClientClub]!
- args: page: Int, first: Int, q: String, city: String, accept_payments: Boolean, booking_enabled: Boolean
## service
- returns: Service!
- args: id: Int!
- description: soft_exist:users,id
## services
- returns: [Service]!
- args: input: ServicesInput
- description: @orderBy(column: "id", direction: DESC)
## sessionsMoneyReport
- returns: UnifiedReport!
- args: input: SessionsMoneyReport!
## settingValues
- returns: [SettingPair]!
- args: none
## shellSettingList
- returns: String!
- args: none
## shellSettingValues
- returns: String!
- args: none
## shortcut
- returns: Shortcut!
- args: id: Int!
- description: exists:shortcuts,id
## shortcutGroup
- returns: ShortcutGroup!
- args: id: Int!
- description: exists:shortcut_groups,id
## shortcutGroups
- returns: [ShortcutGroup]!
- args: none
## shortcuts
- returns: [Shortcut]!
- args: none
- description: @orderBy(column: "sort", direction: ASC)
## tariffGrid
- returns: [TariffGridItem]!
- args: input: TariffGridInput
## tariffs
- returns: TariffPaginated!
- args: page: Int, first: Int, filter: TariffsFilterInput
## tasks
- returns: WorkerTaskPaginated!
- args: page: Int, first: Int
## topSoldOverviewItemsReport
- returns: UnifiedReport!
- args: input: ReportInput!
## uniqueUsersReport
- returns: UnifiedReport!
- args: input: UniqueUsersReport!
## updateLicensePayment
- returns: LicensePaymentData!
- args: id: Int!, status: LicensePaymentStatus!
## user
- returns: User!
- args: uuid: String!
## userClubs
- returns: [UserClub]!
- args: input: UserClubsInput
## userGroup
- returns: UserGroup!
- args: uuid: String!
## userGroups
- returns: [UserGroup]!
- args: none
## userImportStatus
- returns: Import!
- args: id: Int!
## usersBonusReport
- returns: UnifiedReport!
- args: input: UsersBonusReport!
## validatePayment
- returns: Boolean!
- args: input: PaymentInput!
## validatePromoCode
- returns: PromoCode!
- args: input: ValidatePromoCodeInput!
## validateRefund
- returns: Boolean!
- args: input: RefundPaymentInput!
## versions
- returns: Versions
- args: none
## workers
- returns: UserPaginated!
- args: input: WorkersInput, page: Int, first: Int
## workShift
- returns: WorkShift!
- args: id: Int!
- description: exists:work_shifts,id
## workShifts
- returns: WorkShiftPaginated!
- args: input: WorkShiftInput, page: Int, first: Int
## workShiftsReport
- returns: UnifiedReport!
- args: input: WorkShiftsReport!
## workShiftsSummaryReport
- returns: UnifiedReport!
- args: input: WorkShiftsReport!
## workShiftSummary
- returns: WorkShiftSummary!
- args: id: Int!