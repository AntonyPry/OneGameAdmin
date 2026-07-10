# Smartshell Mutation Operations

## activateTrial
- returns: Boolean!
- args: id: Int!
## addCompaniesToNetwork
- returns: [NetworkCompany]!
- args: company_ids: [Int]!, input: NetworkCompanyInput!
## adminCallDone
- returns: Boolean!
- args: id: Int!
## applyNewHostDevices
- returns: Host!
- args: id: Int!
## banClient
- returns: User!
- args: uuid: String!, input: FlagInput!
## callAdmin
- returns: Boolean!
- args: none
## changeClientSessionHost
- returns: ClientSession!
- args: id: Int!, input: ChangeClientSessionHostInput!
- description: exists:client_sessions,id
## changeGoodsQuantity
- returns: Boolean!
- args: input: ChangeGoodsQuantityInput!
## changeUsersGroup
- returns: UserGroup
- args: input: ChangeUsersGroupInput!
## clientBookingCancel
- returns: ClientBooking!
- args: id: Int!, companyId: Int, noPenalty: Boolean
## clientBuyPremium
- returns: PremiumPayment!
- args: none
## clientLogin
- returns: AccessToken!
- args: input: ClientLoginInput!
## clientRefreshToken
- returns: AccessToken!
- args: input: RefreshTokenInput!
## clientRegister
- returns: User!
- args: input: ClientRegisterInput!
## clientResetPassword
- returns: User!
- args: input: ResetPasswordInput!
## clientUpdateMe
- returns: User!
- args: input: UpdateClientMeInput!
## clientUpdatePassword
- returns: User!
- args: input: UpdatePasswordInput!
## connectPaymentService
- returns: Boolean!
- args: input: ConnectPaymentServiceInput!, service: IntegrationService!
## copySettings
- returns: Boolean!
- args: id: Int!
## createAchievement
- returns: Achievement!
- args: input: AchievementInput!
## createAdditionalLicensePayment
- returns: LicensePayment!
- args: input: AdditionalLicensePaymentInput!
## createBeneficiaryByInn
- returns: Beneficiary!
- args: idempotency_key: String, input: CreateBeneficiaryByInnInput!
## createBooking
- returns: Booking!
- args: input: BookingInput!
## createCashOrder
- returns: CashOrder!
- args: input: CashOrderInput!
## createCategory
- returns: Category!
- args: input: CategoryInput!
## createClientBooking
- returns: Booking!
- args: input: ClientBookingInput!
## createClientClubComment
- returns: ClubComment!
- args: input: ClientClubCommentInput!
## createClub
- returns: Club!
- args: input: ClubInput!
## createClubComment
- returns: ClubComment!
- args: input: ClubCommentInput!
## createCombo
- returns: Combo!
- args: input: ComboInput!
## createCommand
- returns: HostCommand!
- args: input: CreateCommandInput
## createCommands
- returns: HostCommandList!
- args: input: CreateCommandsInput
## createComment
- returns: Comment!
- args: input: CommentInput!
## createCompanyNews
- returns: CompanyNewsArticle!
- args: input: CreateNewsArticleInput!
## createContractor
- returns: Contractor!
- args: input: ContractorInput!
## createDepositCashback
- returns: DepositCashback!
- args: input: DepositCashbackInput!
## createDiscount
- returns: Discount!
- args: input: DiscountInput!
## createGameAccount
- returns: GameAccount!
- args: input: CreateGameAccountInput!
## createGameAccountGroup
- returns: GameAccountGroup!
- args: input: GameAccountGroupInput!
## createGood
- returns: Good!
- args: input: GoodInput!
## createHost
- returns: Host!
- args: input: HostInput!
## createHostCommandTemplate
- returns: HostCommandTemplate!
- args: input: CreateHostCommandTemplateInput!
## createHostGroup
- returns: HostGroup!
- args: input: HostGroupInput!
## createHostPIN
- returns: String!
- args: hostId: Int!
## createHostType
- returns: HostType!
- args: input: HostTypeInput!
- deprecated: No longer supported
## createLicenseModule
- returns: LicenseTariffModule!
- args: input: LicenseTariffModuleInput!
## createLicenseModuleCategory
- returns: LicenseTariffCategory!
- args: input: LicenseTariffCategoryInput!
## createLicensePayment
- returns: LicensePayment!
- args: input: LicensePaymentInput!
## createLicenseTariff
- returns: LicenseTariff!
- args: input: LicenseTariffInput!
## createNetwork
- returns: Network!
- args: input: CreateNetworkInput!
## createOwner
- returns: Owner!
- args: input: OwnerInput!
## createPayment
- returns: Payment!
- args: input: PaymentInput!
## createPaymentTransaction
- returns: PaymentTransaction!
- args: input: PaymentTransactionInput!, type: PaymentTransactionType
## createPromoCode
- returns: PromoCode!
- args: input: PromoCodeInput!
## createService
- returns: Service!
- args: input: ServiceInput!
## createShortcut
- returns: Shortcut!
- args: input: ShortcutInput!, sync: SyncScope
## createShortcutGroup
- returns: ShortcutGroup!
- args: input: ShortcutGroupInput!, sync: SyncScope
## createShortcutGroups
- returns: [ShortcutGroup]!
- args: input: [ShortcutGroupItem]!, sync: SyncScope
## createTariff
- returns: Tariff!
- args: input: TariffInput!
## createUserGroup
- returns: UserGroup!
- args: input: UserGroupInput!
## createWorker
- returns: User!
- args: input: CreateWorkerInput!
## createWorkerTask
- returns: WorkerTask!
- args: input: WorkerTaskInput!
## deleteAchievement
- returns: Achievement!
- args: id: String!
## deleteCategory
- returns: Category!
- args: id: Int!
## deleteClub
- returns: Club!
- args: id: Int!
## deleteCombo
- returns: Combo!
- args: id: Int!
## deleteComment
- returns: Comment!
- args: id: Int!
- description: exists:comments,id
## deleteCompanyNews
- returns: CompanyNewsArticle!
- args: id: ID!
## deleteContractor
- returns: Contractor!
- args: id: Int!
## deleteDepositCashback
- returns: DepositCashback!
- args: id: Int!
## deleteDiscount
- returns: Discount!
- args: id: Int!
- description: soft_exist:discounts,id
## deleteGameAccount
- returns: GameAccount!
- args: id: Int!
- description: exists:game_accounts,id
## deleteGameAccountGroup
- returns: GameAccountGroup!
- args: id: Int!
- description: exists:game_account_groups,id
## deleteGood
- returns: Good!
- args: id: Int!
- description: "soft_exist:goods,id
## deleteGoods
- returns: Boolean!
- args: ids: [Int]!
## deleteHost
- returns: Host!
- args: id: Int!
## deleteHostCommandTemplate
- returns: Boolean!
- args: id: Int!
## deleteHostGroup
- returns: HostGroup!
- args: id: Int!
- description: exists:host_groups,id
## deleteHostType
- returns: HostType!
- args: id: Int!
- description: exists:host_types,id
- deprecated: No longer supported
## deleteLicenseModule
- returns: LicenseTariffModule!
- args: id: Int!
## deleteLicenseModuleCategory
- returns: LicenseTariffCategory!
- args: id: Int!
## deleteLicenseTariff
- returns: LicenseTariff!
- args: id: Int!
## deleteNetworkCompany
- returns: NetworkCompany!
- args: id: Int!
## deleteOrganizationPaymentCard
- returns: OrganizationPaymentCard!
- args: id: Int!
## deletePromoCode
- returns: PromoCode!
- args: id: Int!
- description: soft_exist:promo_codes,id
## deleteService
- returns: Service!
- args: id: Int!
- description: soft_exist:services,id
## deleteShortcut
- returns: Shortcut!
- args: id: Int!, sync: SyncScope
- description: exists:shortcuts,id
## deleteShortcutGroup
- returns: ShortcutGroup!
- args: id: Int!, sync: SyncScope
- description: exists:shortcut_groups,id
## deleteTariff
- returns: Tariff!
- args: id: Int!
## deleteUserGroup
- returns: UserGroup!
- args: uuid: String!
## deleteWorker
- returns: User!
- args: id: Int!
## deleteWorkerTask
- returns: WorkerTask!
- args: id: Int!
## disableWorker
- returns: User!
- args: id: Int!, input: FlagInput!
## disconnectPaymentService
- returns: Boolean!
- args: service: IntegrationService!
## emailRegister
- returns: User!
- args: input: EmailRegisterInput!
## executeDealAndPayToCheckingAccount
- returns: BeneficiaryDeal!
- args: input: WithdrawToCheckingAccountInput!
## finishClientSession
- returns: ClientSession!
- args: none
## finishHostSession
- returns: HostSession!
- args: none
## finishWorkShift
- returns: WorkShift!
- args: input: FinishWorkShiftInput, confirm_pass: String!
## forceDeleteUser
- returns: User!
- args: id: Int!, pass: String!
## forceFinishWorkShift
- returns: WorkShift!
- args: input: FinishWorkShiftInput
## freeGameAccount
- returns: GameAccount!
- args: id: Int!
- description: exists:client_sessions,id
## generateQR
- returns: String!
- args: input: GenerateQRInput!
## importClub
- returns: Boolean!
- args: club_id: Int!, org_id: Int!, code: String!, file: Upload!
## importUsers
- returns: Boolean!
- args: club_id: Int!, org_id: Int!, code: String!, file: Upload!, sum_deposit: Boolean!, columns: ImportUserColumnsInput
## importUsersHours
- returns: Boolean!
- args: club_id: Int!, org_id: Int!, code: String!, file: Upload!, columns: ImportUserHoursColumnsInput, timeMultiplier: Int!, tariff_id: Int!
## login
- returns: AccessToken!
- args: input: LoginInput!
## loginQR
- returns: Boolean
- args: input: LoginQRInput!
## logout
- returns: Boolean!
- args: none
## magicInit
- returns: Boolean
- args: input: MagicInput
## magicRoles
- returns: Boolean
- args: none
## magicRoles2
- returns: Boolean
- args: none
## organizationConfirmCode
- returns: ConfirmationResult!
- args: input: OrganizationConfirmationCodeInput!
## organizationLogin
- returns: AccessToken!
- args: input: OrganizationLoginInput!
## organizationLogout
- returns: Boolean!
- args: none
## organizationRegister
- returns: Organization!
- args: input: OrganizationRegisterInput!
## organizationResetPassword
- returns: Boolean!
- args: input: OrganizationResetPasswordInput!
## organizationSendConfirmationCode
- returns: Boolean!
- args: input: OrganizationSendConfirmationCodeInput
## organizationStartResetPassword
- returns: String!
- args: input: OrganizationStartResetPasswordInput!
## organizationUpdate
- returns: Organization!
- args: input: OrganizationInput!
## organizationVerifyConfirmationCode
- returns: Boolean!
- args: input: OrganizationVerifyConfirmationCodeInput!
## penaltyHost
- returns: Host!
- args: input: PenaltyHostInput!
## pickGameAccount
- returns: FreeGameAccount!
- args: input: pickGameAccountInput!
## processPostPayment
- returns: Payment!
- args: id: Int!, input: ProcessPostPaymentInput!
## processStats
- returns: Boolean!
- args: input: ProcessStatsInput!
## purchaseTariffByQR
- returns: Payment!
- args: input: TariffPurchaseByQRInput!
## readAllClubComments
- returns: Boolean
- args: none
## readClubComment
- returns: ClubComment!
- args: id: Int!
## refreshToken
- returns: AccessToken!
- args: input: RefreshTokenInput!
## refundPayment
- returns: Payment!
- args: input: RefundPaymentInput!
## register
- returns: User!
- args: input: RegisterInput!
## registerHost
- returns: String!
- args: input: RegisterHostInput!
## relogin
- returns: AccessToken!
- args: id: Int!
## resetPassword
- returns: Me!
- args: input: ResetPasswordInput!
## resetUserPassword
- returns: User!
- args: uuid: String!
## sendClientConfirmationCode
- returns: Boolean!
- args: input: SendConfirmationCodeInput!
## sendClubOnVerification
- returns: Club!
- args: id: Int!
## sendConfirmationCode
- returns: Boolean!
- args: input: SendConfirmationCodeInput!
## sendConfirmationCodeToEnter
- returns: User!
- args: input: SendConfirmationCodeToEnterInput!
## sendExtendConfirmationCode
- returns: Boolean!
- args: input: SendConfirmationCodeInput!
## sendWakePacket
- returns: Boolean!
- args: input: SendWakePacketInput!
## sendWakePackets
- returns: Boolean!
- args: input: SendWakePacketsInput!
## setBeneficiaryToCompany
- returns: Beneficiary!
- args: id: String!, company_id: Int!
## setBonus
- returns: User!
- args: input: SetBonusInput!
## setBookingStatus
- returns: Booking!
- args: id: Int!, status: BookingStatus!
## setCloudPaymentsAccountToCompany
- returns: CloudPaymentsAccount!
- args: input: SetCloudPaymentsAccountToCompanyInput!
## setClubAutoPayCardId
- returns: Club!
- args: id: Int!, card_id: Int!
## setClubAutoPayStatus
- returns: Club!
- args: id: Int!, status: Boolean!
## setClubDepositTransferStatus
- returns: Club!
- args: id: Int!, enabled: Boolean!
- deprecated: use networks, transfer available only for network
## setCompanyOwner
- returns: Owner!
- args: input: ChangeCompanyOwnerInput!
## setDeposit
- returns: User!
- args: input: SetDepositInput!
## setHostServiceMode
- returns: Host!
- args: id: Int!, input: FlagInput!
## setMultipleSettingValues
- returns: Boolean!
- args: input: UpdateMultipleSettingsInput!
## setSetting
- returns: Setting!
- args: input: UpdateSettingInput!
## setSettings
- returns: [Setting]!
- args: input: UpdateMultipleSettingsInput!
## setSettingValue
- returns: Boolean!
- args: input: UpdateSettingInput!
## setShellMode
- returns: Host!
- args: mode: ShellMode!, worker_id: Int
## setShortcutFavorite
- returns: Boolean!
- args: id: Int!, flag: Boolean!
## setTelegramChannel
- returns: Boolean!
- args: input: SetTelegramChannelInput!
- deprecated: No longer supported
## setUserDiscount
- returns: User!
- args: input: SetUserDiscountInput!
## setWorkerTaskComplete
- returns: WorkerTask!
- args: id: Int!, value: Boolean!
## shortcutClicked
- returns: Boolean!
- args: input: ShortcutStatsInput!
## startClientSession
- returns: ClientSession!
- args: input: StartClientSessionInput!
## startHostSession
- returns: HostSession!
- args: input: HostSessionInput!
## startWorkShift
- returns: WorkShift!
- args: input: StartWorkShiftInput!
## stopClientSession
- returns: ClientSession!
- args: id: Int!, ignorePause: Boolean
- description: exists:client_sessions,id
## transferDeposit
- returns: User!
- args: input: TransferDepositInput!
## unpauseClientSession
- returns: ClientSession!
- args: id: Int!, host_id: Int!
## updateBeneficiaryBankDetails
- returns: BeneficiaryBankDetails!
- args: id: String!, input: UpdateBankAccountInput!
## updateBooking
- returns: Booking!
- args: id: Int!, input: BookingInput!
## updateCategory
- returns: Category!
- args: id: Int!, input: CategoryInput!
## updateClub
- returns: Club!
- args: id: Int!, input: UpdateClubInput!
## updateCombo
- returns: Combo!
- args: id: Int!, input: ComboInput!
## updateComment
- returns: Comment!
- args: id: Int!, input: CommentUpdateInput!
## updateCompanyNews
- returns: CompanyNewsArticle!
- args: id: ID!, input: UpdateNewsArticleInput!
## updateCompanyPermissions
- returns: CompanyPermissionsData!
- args: input: UpdateCompanyPermissionsInput!
## updateContractor
- returns: Contractor!
- args: id: Int!, input: ContractorInput!
## updateDepositCashback
- returns: DepositCashback!
- args: id: Int!, input: DepositCashbackInput!
## updateDiscount
- returns: Discount!
- args: id: Int!, input: DiscountUpdateInput!
- description: soft_exist:discounts,id
## updateGameAccount
- returns: GameAccount!
- args: id: Int!, input: UpdateGameAccountInput!
- description: exists:game_accounts,id
## updateGameAccountGroup
- returns: GameAccountGroup!
- args: id: Int!, input: GameAccountGroupInput!
- description: exists:game_account_groups,id
## updateGood
- returns: Good!
- args: id: Int!, input: GoodInput!
- description: "soft_exist:goods,id
## updateGoods
- returns: Boolean!
- args: ids: [Int]!, input: UpdateGoodsInput!
## updateHost
- returns: Host!
- args: id: Int!, input: HostInput!
## updateHostCommandStatus
- returns: HostCommand!
- args: input: UpdateHostCommandStatusInput!
## updateHostCommandTemplate
- returns: HostCommandTemplate!
- args: input: UpdateHostCommandTemplateInput!
## updateHostGroup
- returns: HostGroup!
- args: id: Int!, input: HostGroupInput!
- description: exists:host_groups,id
## updateHostIpAddress
- returns: Host!
- args: ip: String
## updateHosts
- returns: Boolean!
- args: input: [HostsInput]!
## updateHostState
- returns: HostStatus!
- args: input: UpdateHostStateInput!
## updateHostType
- returns: HostType!
- args: id: Int!, input: HostTypeInput!
- description: exists:host_types,id
- deprecated: No longer supported
## updateLicenseModule
- returns: LicenseTariffModule!
- args: id: Int!, input: LicenseTariffModuleInput!
## updateLicenseModuleCategory
- returns: LicenseTariffCategory!
- args: id: Int!, input: LicenseTariffCategoryInput!
## updateLicenseTariff
- returns: LicenseTariff!
- args: id: Int!, input: LicenseTariffInput!
## updateMe
- returns: Me!
- args: input: UpdateMeInput!
## updateNetwork
- returns: Network!
- args: id: ID!, input: UpdateNetworkInput!
## updateNetworkCompany
- returns: NetworkCompany!
- args: company_id: Int!, input: NetworkCompanyInput!
## updateNewsConsent
- returns: User!
- args: consent: Boolean!
## updateOwner
- returns: Owner!
- args: id: Int!, input: UpdateOwnerInput!
## updatePassword
- returns: Me!
- args: input: UpdatePasswordInput!
## updatePromoCode
- returns: PromoCode!
- args: id: Int!, input: PromoCodeInput!
- description: soft_exist:promo_codes,id
## updateService
- returns: Service!
- args: id: Int!, input: ServiceInput!
- description: soft_exist:services,id
## updateShortcut
- returns: Shortcut!
- args: id: Int!, input: ShortcutInput!, sync: SyncScope
- description: exists:shortcuts,id
## updateShortcutGroup
- returns: ShortcutGroup!
- args: id: Int!, input: ShortcutGroupInput!, sync: SyncScope
- description: exists:shortcut_groups,id
## updateShortcutGroupSort
- returns: Boolean!
- args: input: [UpdateShortcutGroupSortInput]!
## updateShortcutSort
- returns: Boolean!
- args: input: [UpdateShortcutSortInput]!
## updateTariff
- returns: Tariff!
- args: id: Int!, input: TariffInput!
## updateTariffSort
- returns: Boolean!
- args: input: [UpdateTariffsSortInput]!
## updateTelegramSettings
- returns: TelegramSettings!
- args: input: SetTelegramSettingsInput!
## updateUserGroup
- returns: UserGroup!
- args: uuid: String!, input: UserGroupInput!
## updateWorker
- returns: User!
- args: id: Int!, input: UpdateWorkerInput!
## updateWorkerTask
- returns: WorkerTask!
- args: id: Int!, input: WorkerTaskInput!
## uploadShortcutImage
- returns: String
- args: input: ShortcutImageInput!
## uploadUserTable
- returns: Int!
- args: input: UserTableInput!
## useDebt
- returns: Boolean!
- args: none
## validateQR
- returns: Boolean!
- args: input: ValidateQRInput!
## verifyClient
- returns: User!
- args: id: Int!, input: VerifyUserInput!
## verifyMe
- returns: Boolean!
- args: input: VerifyUserInput!
## verifyUser
- returns: User!
- args: id: Int!, input: VerifyUserInput!